import { Button, Input, Modal, Space, message } from 'antd';
import type { Edge, Node } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { CanvasEditor } from '../components/canvas/CanvasEditor';
import { useCanvasStore } from '../stores/canvasStore';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { loadCanvas, saveCanvas } from '../api/canvas';
import { getProject } from '../api/projects';
import {
  createSnapshot as createSnapshotApi,
  deleteSnapshot as deleteSnapshotApi,
  getSnapshot,
  listSnapshots,
  newIdempotencyKey,
  restoreSnapshot,
} from '../api/snapshots';
import { toApiError } from '../api/client';
import { KEYMAP } from '../core/shortcuts/keymap';
import { canvasFingerprint, normalizeCanvasData } from '../core/canvas/fingerprint';
import { SaveCoordinator } from '../core/save/coordinator';
import { decideDraft, deleteDraft, getDraft, putDraft, type Draft } from '../core/save/drafts';
import { createWriterLock, type WriterLock } from '../core/save/tabLock';
import {
  DEFAULT_PROJECT_NAME,
  clearManualSaved,
  clearOriginalFileName,
  clearProjectCreatedThisSession,
  discardOutcome,
  exitPrompt,
  getOriginalFileName,
  isManuallySaved,
  isProjectCreatedThisSession,
  markManualSaved,
} from '../core/save/flags';
import { ProjectNameModal } from '../components/save/ProjectNameModal';
import { ExitConfirmModal } from '../components/save/ExitConfirmModal';
import { SnapshotNameModal } from '../components/save/SnapshotNameModal';
import { SnapshotDrawer } from '../components/save/SnapshotDrawer';
import { DraftRecoveryModal } from '../components/save/DraftRecoveryModal';
import { SaveStatusBar } from '../components/save/SaveStatusBar';
import type { ProjectSummary, SnapshotMeta } from '../types';

type NameModalState = {
  mode: 'save' | 'exit';
  proceed?: () => void;
  thenSnapshot?: boolean;
};

const EMPTY_VIEWPORT = { x: 0, y: 0, zoom: 1 };

export function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = useAuthStore((s) => s.user?.id) ?? 'anonymous';
  const createProject = useProjectStore((s) => s.create);
  const updateProject = useProjectStore((s) => s.update);
  const removeProject = useProjectStore((s) => s.remove);
  const recentProjects = useProjectStore((s) => s.recent);
  const setGuard = useWorkspaceStore((s) => s.setGuard);

  const coordinatorRef = useRef<SaveCoordinator | null>(null);
  const lockRef = useRef<WriterLock | null>(null);
  const writerRef = useRef(true);
  const loadedRef = useRef(false);
  const manualSavedRef = useRef(false);
  const blockingRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);
  const draftErrorShownRef = useRef(false);
  const allowNavigationUntilRef = useRef(0);
  const snapshotKeyRef = useRef('');

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [, setManualSaved] = useState(false);
  const [isWriter, setIsWriter] = useState<boolean | null>(null);
  const [saveHint, setSaveHint] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<'retrying' | 'persistent' | null>(null);
  const [conflict, setConflict] = useState<{ serverVersion?: number } | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);

  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotDrawerOpen, setSnapshotDrawerOpen] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const [nameModal, setNameModal] = useState<NameModalState | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [exitConfirm, setExitConfirm] = useState<{ proceed: () => void } | null>(null);
  const [exitBusy, setExitBusy] = useState(false);

  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState(DEFAULT_PROJECT_NAME);
  const [saveAsBusy, setSaveAsBusy] = useState(false);

  const [draftPrompt, setDraftPrompt] = useState<Draft | null>(null);
  const [draftStale, setDraftStale] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const liveProjectName = recentProjects.find((item) => item.id === projectId)?.name
    ?? project?.name
    ?? DEFAULT_PROJECT_NAME;
  const originalName = projectId ? getOriginalFileName(projectId) : null;

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (Date.now() < allowNavigationUntilRef.current) return false;
    if (!loadedRef.current) return false;
    if (currentLocation.pathname === nextLocation.pathname) return false;
    return writerRef.current === false
      || !manualSavedRef.current
      || (coordinatorRef.current?.isDirty() ?? false);
  });

  const allowNavigation = useCallback((proceed: () => void) => {
    allowNavigationUntilRef.current = Date.now() + 30000;
    proceed();
  }, []);

  useEffect(() => {
    allowNavigationUntilRef.current = 0;
  }, [location.key]);

  const updateManualSaved = useCallback((value: boolean) => {
    manualSavedRef.current = value;
    setManualSaved(value);
  }, []);

  const showAutoSaveHint = useCallback((at: Date) => {
    setSaveHint(at);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setSaveHint(null), 2000);
  }, []);

  useEffect(() => {
    blockingRef.current = !!nameModal
      || !!exitConfirm
      || snapshotModalOpen
      || snapshotBusy
      || restoreBusy
      || saveAsOpen
      || !!draftPrompt
      || !!conflict;
  }, [nameModal, exitConfirm, snapshotModalOpen, snapshotBusy, restoreBusy, saveAsOpen, draftPrompt, conflict]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    loadedRef.current = false;
    setLoaded(false);
    setProject(null);
    setConflict(null);
    setSaveError(null);
    setSaveHint(null);
    updateManualSaved(false);
    setSnapshots([]);
    setIsWriter(null);
    setNameModal(null);
    setExitConfirm(null);
    setSnapshotDrawerOpen(false);
    setSnapshotModalOpen(false);
    setSaveAsOpen(false);
    setDraftPrompt(null);
    setRestoreBusy(false);
    setConflictBusy(false);
    writerRef.current = true;
    coordinatorRef.current = null;
    useCanvasStore.getState().loadState([], [], EMPTY_VIEWPORT, 1);

    const load = async () => {
      try {
        const currentUserId = useAuthStore.getState().user?.id ?? 'anonymous';
        const [projectData, canvas, snapshotList] = await Promise.all([
          getProject(projectId),
          loadCanvas(projectId),
          listSnapshots(projectId).catch(() => [] as SnapshotMeta[]),
        ]);
        if (cancelled) return;

        setProject(projectData);
        setSnapshots(snapshotList);
        const inferred = isManuallySaved({
          projectId,
          projectName: projectData.name,
          snapshotCount: snapshotList.length,
        });
        if (inferred) markManualSaved(projectId);
        updateManualSaved(inferred);

        useCanvasStore.getState().loadState(
          canvas.nodes,
          canvas.edges,
          canvas.viewport,
          canvas.version,
        );
        const serverFingerprint = canvasFingerprint(canvas.nodes, canvas.edges);

        const coordinator = new SaveCoordinator(
          {
            getState: () => {
              const state = useCanvasStore.getState();
              return { nodes: state.nodes, edges: state.edges, viewport: state.viewport };
            },
            save: (payload) => saveCanvas(projectId, {
              nodes: payload.nodes,
              edges: payload.edges,
              viewport: payload.viewport,
              version: payload.baseRevision,
            }),
            fetchServer: () => loadCanvas(projectId),
            isBlocked: () => blockingRef.current,
            isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
            isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
            isWriter: () => writerRef.current,
            onSaved: ({ version }) => {
              useCanvasStore.setState({ version });
              if (!coordinatorRef.current?.isDirty()) {
                void deleteDraft(currentUserId, projectId);
              }
            },
            onAutoSaved: (at) => showAutoSaveHint(at),
            onError: (kind) => {
              setSaveError(kind);
              if (kind === 'retrying') {
                if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
                retryTimerRef.current = window.setTimeout(() => {
                  if (!cancelled) void coordinatorRef.current?.autoSave();
                }, 10000);
              }
            },
            onClearError: () => setSaveError(null),
            onConflict: () => {
              setConflict({});
              setSaveError(null);
            },
            onConflictResolved: (version) => {
              useCanvasStore.setState({ version });
              setConflict(null);
            },
          },
          { revision: canvas.version, fingerprint: serverFingerprint },
        );
        coordinatorRef.current = coordinator;
        loadedRef.current = true;
        setLoaded(true);

        const draft = await getDraft(currentUserId, projectId);
        if (cancelled || !draft) return;
        const decision = decideDraft(draft, canvas.version, serverFingerprint);
        if (decision === 'discard') {
          await deleteDraft(currentUserId, projectId);
          return;
        }
        setDraftStale(decision === 'stale');
        setDraftPrompt(draft);
      } catch {
        if (!cancelled) message.error('加载画布失败，请确认后端已启动');
      }
    };

    void load();

    return () => {
      cancelled = true;
      loadedRef.current = false;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      coordinatorRef.current = null;
    };
  }, [projectId, showAutoSaveHint, updateManualSaved]);

  useEffect(() => {
    if (!loaded || !projectId) return;
    const lock = createWriterLock(projectId, (writer) => {
      writerRef.current = writer;
      setIsWriter(writer);
    });
    lockRef.current = lock;
    return () => {
      lock.dispose();
      lockRef.current = null;
    };
  }, [loaded, projectId]);

  const reloadLatest = useCallback(async (silent = false) => {
    if (!projectId) return;
    const canvas = await loadCanvas(projectId);
    useCanvasStore.getState().loadState(canvas.nodes, canvas.edges, canvas.viewport, canvas.version);
    coordinatorRef.current?.reset(canvas.version);
    setConflict(null);
    setSaveError(null);
    await deleteDraft(userId, projectId);
    if (!silent) message.success('已重新加载');
  }, [projectId, userId]);

  const promptTakeover = useCallback(() => {
    Modal.confirm({
      title: '接管编辑',
      content: '该项目正在另一个标签页编辑。接管将丢弃本页未保存的修改并重新加载最新画布。',
      okText: '接管',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        lockRef.current?.takeOver();
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        await reloadLatest();
        message.success('已接管编辑');
      },
    });
  }, [reloadLatest]);

  const refreshSnapshots = useCallback(async () => {
    if (!projectId) return;
    setSnapshotsLoading(true);
    try {
      const list = await listSnapshots(projectId);
      setSnapshots(list);
      if (list.length > 0 && !manualSavedRef.current) {
        markManualSaved(projectId);
        updateManualSaved(true);
      }
    } catch {
      message.error('加载快照列表失败');
    } finally {
      setSnapshotsLoading(false);
    }
  }, [projectId, updateManualSaved]);

  const performSave = useCallback(async (silent = false) => {
    if (writerRef.current === false) {
      promptTakeover();
      return false;
    }
    const coordinator = coordinatorRef.current;
    if (!coordinator) return false;
    const result = await coordinator.save('manual');
    if (result.status === 'saved' || result.status === 'unchanged') {
      if (!silent) message.success('已保存');
      return true;
    }
    if (result.status === 'conflict') {
      message.warning('画布已在其他端修改，请先处理冲突');
    } else if (result.status === 'failed') {
      message.error('保存失败，请稍后重试');
    }
    return false;
  }, [promptTakeover]);

  const openSnapshotModal = useCallback(() => {
    snapshotKeyRef.current = newIdempotencyKey();
    setSnapshotName(`版本 ${new Date().toLocaleString('zh-CN', { hour12: false })}`);
    setSnapshotModalOpen(true);
  }, []);

  const handleVersionConflict = useCallback((error: unknown, coordinator: SaveCoordinator | null) => {
    const apiError = toApiError(error);
    const serverVersion = typeof apiError.details?.serverVersion === 'number'
      ? apiError.details.serverVersion
      : undefined;
    coordinator?.markConflict(serverVersion);
    setConflict({ serverVersion });
    message.warning('画布已在其他端修改，请先处理冲突');
  }, []);

  const onManualSave = useCallback(async () => {
    if (!loadedRef.current) return;
    if (writerRef.current === false) {
      promptTakeover();
      return;
    }
    if (!manualSavedRef.current) {
      setNameModal({ mode: 'save' });
      return;
    }
    await performSave();
  }, [performSave, promptTakeover]);

  const onOpenSnapshot = useCallback(() => {
    if (!loadedRef.current) return;
    if (writerRef.current === false) {
      promptTakeover();
      return;
    }
    if (!manualSavedRef.current) {
      setNameModal({ mode: 'save', thenSnapshot: true });
      return;
    }
    openSnapshotModal();
  }, [openSnapshotModal, promptTakeover]);

  const handleNameSubmit = async (name: string) => {
    if (!projectId || !nameModal) return;
    setNameBusy(true);
    try {
      const saved = await performSave(true);
      if (!saved) return;
      if (name !== liveProjectName) {
        const updated = await updateProject(projectId, name);
        setProject(updated);
      }
      markManualSaved(projectId);
      updateManualSaved(true);
      const pending = nameModal;
      setNameModal(null);
      message.success('已保存');
      if (pending.thenSnapshot) openSnapshotModal();
      pending.proceed?.();
    } catch (error) {
      message.error(toApiError(error).message);
    } finally {
      setNameBusy(false);
    }
  };

  const handleNameLater = async () => {
    if (!projectId || !nameModal) return;
    setNameBusy(true);
    try {
      const saved = await performSave(true);
      if (!saved) return;
      markManualSaved(projectId);
      updateManualSaved(true);
      const pending = nameModal;
      setNameModal(null);
      message.success('已保存');
      if (pending.thenSnapshot) openSnapshotModal();
      pending.proceed?.();
    } finally {
      setNameBusy(false);
    }
  };

  const requestDiscard = (proceed: () => void) => {
    if (!projectId) return;
    const outcome = discardOutcome({
      hasManualSave: manualSavedRef.current,
      createdThisSession: isProjectCreatedThisSession(projectId),
    });
    Modal.confirm({
      title: outcome === 'delete-project' ? '删除未保存的项目' : '放弃未保存的修改',
      content: outcome === 'delete-project'
        ? '该项目在本次会话中新建且从未手动保存。放弃后将删除项目及全部内容，且不可恢复。'
        : '将丢弃当前未保存的修改，保留最后一次成功保存的版本。',
      okText: outcome === 'delete-project' ? '删除并退出' : '放弃修改',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await coordinatorRef.current?.waitForIdle();
          if (outcome === 'delete-project') {
            await removeProject(projectId);
            clearManualSaved(projectId);
            clearOriginalFileName(projectId);
            clearProjectCreatedThisSession(projectId);
          }
          await deleteDraft(userId, projectId);
          setNameModal(null);
          setExitConfirm(null);
          proceed();
        } catch (error) {
          message.error(toApiError(error).message);
        }
      },
    });
  };

  const handleLeave = useCallback((proceed: () => void) => {
    const proceedAllowed = () => allowNavigation(proceed);
    if (!loadedRef.current) {
      proceedAllowed();
      return;
    }
    if (writerRef.current === false) {
      promptTakeover();
      return;
    }
    const prompt = exitPrompt(
      manualSavedRef.current,
      coordinatorRef.current?.isDirty() ?? false,
    );
    if (!prompt) {
      proceedAllowed();
      return;
    }
    if (prompt === 'name-exit') setNameModal({ mode: 'exit', proceed: proceedAllowed });
    else setExitConfirm({ proceed: proceedAllowed });
  }, [allowNavigation, promptTakeover]);

  useEffect(() => {
    if (!loaded) return;
    setGuard(handleLeave);
    return () => setGuard(null);
  }, [loaded, handleLeave, setGuard]);

  const resetBlockedNavigation = () => {
    if (blocker.state === 'blocked') blocker.reset();
  };

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (writerRef.current === false) {
      blocker.reset();
      promptTakeover();
      return;
    }
    handleLeave(() => {
      if (blocker.state === 'blocked') blocker.proceed();
    });
  }, [blocker.state, handleLeave, promptTakeover]);

  const handleSaveAndExit = async () => {
    if (!exitConfirm) return;
    setExitBusy(true);
    try {
      const saved = await performSave(true);
      if (!saved) return;
      const proceed = exitConfirm.proceed;
      setExitConfirm(null);
      message.success('已保存');
      proceed();
    } finally {
      setExitBusy(false);
    }
  };

  const handleCreateSnapshot = async (name: string) => {
    if (!projectId) return;
    if (writerRef.current === false) {
      setSnapshotModalOpen(false);
      promptTakeover();
      return;
    }
    const coordinator = coordinatorRef.current;
    if (!coordinator) return;
    setSnapshotBusy(true);
    try {
      await coordinator.waitForIdle();
      const state = useCanvasStore.getState();
      const contentHash = canvasFingerprint(state.nodes, state.edges);
      const latest = snapshots[0];
      if (latest?.contentHash === contentHash) {
        const proceed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: '内容无变化',
            content: '当前内容与上一张快照完全一致，仍要创建吗？',
            okText: '仍要创建',
            cancelText: '取消',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!proceed) return;
      }

      const normalized = normalizeCanvasData(state.nodes, state.edges);
      const idempotencyKey = snapshotKeyRef.current || newIdempotencyKey();
      snapshotKeyRef.current = idempotencyKey;
      const result = await createSnapshotApi(projectId, {
        name,
        baseRevision: coordinator.getRevision(),
        nodes: normalized.nodes as unknown as Node[],
        edges: normalized.edges as unknown as Edge[],
        viewport: state.viewport,
        contentHash,
        idempotencyKey,
      });
      snapshotKeyRef.current = '';
      coordinator.markSavedExternally(result.revision, contentHash);
      markManualSaved(projectId);
      updateManualSaved(true);
      if (!coordinator.isDirty()) await deleteDraft(userId, projectId);
      setSnapshots((previous) => [result.snapshot, ...previous]);
      setSnapshotModalOpen(false);
      message.success('快照已创建');
    } catch (error) {
      if (toApiError(error).code === 'VERSION_CONFLICT') {
        handleVersionConflict(error, coordinator);
      } else {
        message.error(toApiError(error).message);
      }
    } finally {
      setSnapshotBusy(false);
    }
  };

  const handleRestoreSnapshot = (snapshot: SnapshotMeta) => {
    if (!projectId) return;
    if (writerRef.current === false) {
      promptTakeover();
      return;
    }
    const coordinator = coordinatorRef.current;
    if (!coordinator) return;
    Modal.confirm({
      title: '恢复版本快照',
      content: coordinator.isDirty()
        ? '当前画布有未保存的修改，恢复后将丢失。恢复前会自动创建安全快照。'
        : '确定恢复到此快照吗？恢复前会自动创建安全快照。',
      okText: '恢复',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setRestoreBusy(true);
        try {
          await coordinator.waitForIdle();
          const detail = await getSnapshot(projectId, snapshot.id);
          const result = await restoreSnapshot(projectId, snapshot.id, coordinator.getRevision());
          useCanvasStore.getState().applySnapshot(detail.data.nodes, detail.data.edges);
          coordinator.markSavedExternally(result.revision);
          markManualSaved(projectId);
          updateManualSaved(true);
          await deleteDraft(userId, projectId);
          setConflict(null);
          setSnapshotDrawerOpen(false);
          message.success('已恢复快照');
          void refreshSnapshots();
        } catch (error) {
          if (toApiError(error).code === 'VERSION_CONFLICT') {
            handleVersionConflict(error, coordinator);
          } else {
            message.error(toApiError(error).message);
          }
        } finally {
          setRestoreBusy(false);
        }
      },
    });
  };

  const handleDeleteSnapshot = (snapshot: SnapshotMeta) => {
    if (!projectId) return;
    Modal.confirm({
      title: '删除快照',
      content: `确定删除「${snapshot.name}」吗？删除后保留 7 天可恢复。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteSnapshotApi(projectId, snapshot.id);
          setSnapshots((previous) => previous.filter((item) => item.id !== snapshot.id));
          message.success('已删除');
        } catch (error) {
          message.error(toApiError(error).message);
        }
      },
    });
  };

  const handleReloadConflict = () => {
    Modal.confirm({
      title: '重新加载画布',
      content: '将丢弃本地未保存的修改并加载云端最新版本，确定吗？',
      okText: '重新加载',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setConflictBusy(true);
        try {
          await reloadLatest();
        } catch (error) {
          message.error(toApiError(error).message);
        } finally {
          setConflictBusy(false);
        }
      },
    });
  };

  const handleDownloadBackup = () => {
    const state = useCanvasStore.getState();
    const payload = {
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport,
      version: coordinatorRef.current?.getRevision() ?? state.version,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${liveProjectName}-本地备份-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleOverwriteConflict = () => {
    if (!projectId) return;
    Modal.confirm({
      title: '覆盖云端',
      content: '将读取云端最新版本，然后用本地内容覆盖。确定继续吗？',
      okText: '继续',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setConflictBusy(true);
        try {
          const server = await loadCanvas(projectId);
          Modal.confirm({
            title: '确认覆盖云端',
            content: `云端当前修订为 ${server.version}。本地内容将覆盖该版本，且无法撤销。`,
            okText: '覆盖',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
              try {
                const result = await coordinatorRef.current?.overwrite(server.version);
                if (result?.status === 'saved') {
                  setConflict(null);
                  setSaveError(null);
                  await deleteDraft(userId, projectId);
                  message.success('已覆盖云端');
                }
              } catch (error) {
                message.error(toApiError(error).message);
              }
            },
          });
        } catch (error) {
          message.error(toApiError(error).message);
        } finally {
          setConflictBusy(false);
        }
      },
    });
  };

  const handleApplyDraft = () => {
    if (!draftPrompt) return;
    const revision = coordinatorRef.current?.getRevision() ?? draftPrompt.baseRevision;
    useCanvasStore.getState().loadState(
      draftPrompt.nodes,
      draftPrompt.edges,
      draftPrompt.viewport,
      revision,
    );
    setDraftPrompt(null);
    message.success('已恢复本地草稿');
  };

  const handleOverwriteDraft = () => {
    if (!draftPrompt || !projectId) return;
    const draft = draftPrompt;
    Modal.confirm({
      title: '用草稿覆盖云端',
      content: '将使用本地草稿内容覆盖云端当前版本，确定吗？',
      okText: '覆盖',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const revision = coordinatorRef.current?.getRevision() ?? draft.baseRevision;
        useCanvasStore.getState().loadState(draft.nodes, draft.edges, draft.viewport, revision);
        const result = await coordinatorRef.current?.save('manual', { force: true });
        if (result?.status === 'saved') {
          markManualSaved(projectId);
          updateManualSaved(true);
          if (!coordinatorRef.current?.isDirty()) await deleteDraft(userId, projectId);
          setDraftPrompt(null);
          message.success('已用草稿覆盖云端');
        } else if (result?.status === 'conflict') {
          setDraftPrompt(null);
          setConflict({});
        } else {
          message.error('覆盖失败，请重试');
        }
      },
    });
  };

  const handleExportDraft = () => {
    if (!draftPrompt) return;
    const blob = new Blob(
      [JSON.stringify({
        nodes: draftPrompt.nodes,
        edges: draftPrompt.edges,
        viewport: draftPrompt.viewport,
        version: draftPrompt.baseRevision,
      }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `草稿-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDiscardDraft = () => {
    if (!draftPrompt) return;
    void deleteDraft(userId, projectId ?? draftPrompt.projectId);
    setDraftPrompt(null);
    message.success('已丢弃草稿');
  };

  const openSaveAs = useCallback(() => {
    setSaveAsName(`${liveProjectName} 副本`.slice(0, 100));
    setSaveAsOpen(true);
  }, [liveProjectName]);

  const handleSaveAs = async () => {
    const name = saveAsName.trim();
    if (!name) {
      message.warning('请输入项目名称');
      return;
    }
    if (!projectId) return;
    setSaveAsBusy(true);
    try {
      const state = useCanvasStore.getState();
      const created = await createProject(name);
      await saveCanvas(created.id, {
        nodes: state.nodes,
        edges: state.edges,
        viewport: state.viewport,
        version: 1,
      });
      markManualSaved(created.id);
      clearProjectCreatedThisSession(created.id);
      setSaveAsOpen(false);
      message.success('已另存为新项目');
      allowNavigation(() => navigate(`/project/${created.id}`));
    } catch (error) {
      message.error(toApiError(error).message);
    } finally {
      setSaveAsBusy(false);
    }
  };

  useEffect(() => {
    if (!loaded || !projectId) return;
    const interval = window.setInterval(() => {
      void coordinatorRef.current?.autoSave();
    }, 3 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void coordinatorRef.current?.autoSave();
    };
    const onOnline = () => {
      void coordinatorRef.current?.autoSave();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [loaded, projectId]);

  useEffect(() => {
    if (!loaded) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!coordinatorRef.current?.isDirty()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [loaded]);

  useEffect(() => {
    if (!loaded || !projectId) return;
    let draftTimer: number | undefined;

    const writeDraft = () => {
      if (!loadedRef.current || writerRef.current === false) return;
      const coordinator = coordinatorRef.current;
      if (!coordinator?.isDirty()) return;
      const state = useCanvasStore.getState();
      void putDraft({
        userId,
        projectId,
        nodes: state.nodes,
        edges: state.edges,
        viewport: state.viewport,
        baseRevision: coordinator.getRevision(),
        updatedAt: Date.now(),
        schemaVersion: 1,
      }).catch(() => {
        if (draftErrorShownRef.current) return;
        draftErrorShownRef.current = true;
        message.warning('本地草稿保存失败');
      });
    };

    const scheduleDraft = () => {
      if (draftTimer) window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(writeDraft, 1500);
    };

    const unsubscribe = useCanvasStore.subscribe((state, previous) => {
      if (
        state.nodes === previous.nodes
        && state.edges === previous.edges
        && state.viewport === previous.viewport
      ) return;
      scheduleDraft();
    });

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') writeDraft();
    };

    window.addEventListener('pagehide', writeDraft);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      if (draftTimer) window.clearTimeout(draftTimer);
      window.removeEventListener('pagehide', writeDraft);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loaded, projectId, userId]);

  useHotkeys(KEYMAP.save, () => void onManualSave(), { preventDefault: true }, [onManualSave]);
  useHotkeys(KEYMAP.createSnapshot, () => onOpenSnapshot(), { preventDefault: true }, [onOpenSnapshot]);
  useHotkeys(KEYMAP.saveAs, () => openSaveAs(), { preventDefault: true }, [openSaveAs]);

  return (
    <AppLayout>
      <CanvasEditor key={projectId} />
      <Space style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
        <Button onClick={() => void onManualSave()}>保存</Button>
        <Button onClick={onOpenSnapshot}>快照</Button>
        <Button
          onClick={() => {
            setSnapshotDrawerOpen(true);
            void refreshSnapshots();
          }}
        >
          版本历史
        </Button>
        <Button onClick={openSaveAs}>另存为</Button>
      </Space>

      <SaveStatusBar
        hintAt={saveHint}
        error={saveError}
        conflict={!!conflict}
        writer={isWriter}
        busy={conflictBusy}
        onRetry={() => void coordinatorRef.current?.autoSave()}
        onReload={handleReloadConflict}
        onBackup={handleDownloadBackup}
        onOverwrite={handleOverwriteConflict}
        onTakeOver={promptTakeover}
      />

      <ProjectNameModal
        open={!!nameModal}
        mode={nameModal?.mode ?? 'save'}
        initialName={liveProjectName}
        originalName={originalName}
        busy={nameBusy}
        onSubmit={handleNameSubmit}
        onLater={handleNameLater}
        onDiscard={nameModal?.mode === 'exit' && nameModal.proceed
          ? () => requestDiscard(nameModal.proceed as () => void)
          : undefined}
        onCancel={() => {
          if (nameBusy) return;
          setNameModal(null);
          resetBlockedNavigation();
        }}
      />

      <ExitConfirmModal
        open={!!exitConfirm}
        busy={exitBusy}
        onSaveAndExit={handleSaveAndExit}
        onDiscard={() => {
          if (exitConfirm) requestDiscard(exitConfirm.proceed);
        }}
        onCancel={() => {
          if (exitBusy) return;
          setExitConfirm(null);
          resetBlockedNavigation();
        }}
      />

      <SnapshotNameModal
        open={snapshotModalOpen}
        initialName={snapshotName}
        busy={snapshotBusy}
        onSubmit={handleCreateSnapshot}
        onCancel={() => {
          if (snapshotBusy) return;
          snapshotKeyRef.current = '';
          setSnapshotModalOpen(false);
        }}
      />

      <SnapshotDrawer
        open={snapshotDrawerOpen}
        snapshots={snapshots}
        loading={snapshotsLoading}
        onClose={() => setSnapshotDrawerOpen(false)}
        onRefresh={() => void refreshSnapshots()}
        onRestore={handleRestoreSnapshot}
        onDelete={handleDeleteSnapshot}
      />

      <DraftRecoveryModal
        open={!!draftPrompt}
        stale={draftStale}
        updatedAt={new Date(draftPrompt?.updatedAt ?? Date.now()).toISOString()}
        onApply={handleApplyDraft}
        onOverwrite={handleOverwriteDraft}
        onExport={handleExportDraft}
        onDiscard={handleDiscardDraft}
        onClose={() => setDraftPrompt(null)}
      />

      <Modal
        open={saveAsOpen}
        title="另存为"
        okText="保存"
        cancelText="取消"
        confirmLoading={saveAsBusy}
        onOk={handleSaveAs}
        onCancel={() => {
          if (!saveAsBusy) setSaveAsOpen(false);
        }}
      >
        <Input
          placeholder="项目名称"
          maxLength={100}
          value={saveAsName}
          onChange={(event) => setSaveAsName(event.target.value)}
          onPressEnter={handleSaveAs}
        />
      </Modal>
    </AppLayout>
  );
}
