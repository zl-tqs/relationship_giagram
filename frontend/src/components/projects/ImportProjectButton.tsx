import { Button, message } from 'antd';
import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { saveCanvas } from '../../api/canvas';
import { toApiError } from '../../api/client';
import { parseProjectFile } from '../../core/import/projectFile';
import { setOriginalFileName } from '../../core/save/flags';

export function ImportProjectButton({ block = false }: { block?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const create = useProjectStore((s) => s.create);
  const requestLeave = useWorkspaceStore((s) => s.requestLeave);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const importFile = async (file: File) => {
    setLoading(true);
    try {
      const imported = parseProjectFile(file.name, await file.text());
      const project = await create(imported.name);
      setOriginalFileName(project.id, file.name);
      await saveCanvas(project.id, imported.state);
      message.success('已导入项目');
      navigate(`/project/${project.id}`);
    } catch (error) {
      const known = error instanceof Error && /项目文件|JSON/.test(error.message);
      message.error(known ? (error as Error).message : toApiError(error).message);
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    requestLeave(() => {
      void importFile(file);
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".rmap,.json,application/json"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
      <Button block={block} loading={loading} onClick={() => inputRef.current?.click()}>
        打开文件
      </Button>
    </>
  );
}
