import {
  Alert, AutoComplete, Button, Card, Checkbox, Empty, Input, Select, Space, Spin, Steps,
  Table, Tag, Typography, Upload, message,
} from 'antd';
import type { TableProps } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  confirmAnalysis, createAnalysisJob, getAnalysisQuota, saveAnalysisStructured,
  updateAnalysisResult, type AnalysisQuota,
} from '../api/analysis';
import { saveCanvas } from '../api/canvas';
import { toApiError } from '../api/client';
import { mergeCandidateRows, type MergeableCandidate } from '../core/analysis/candidates';
import { buildExcerpt } from '../core/analysis/excerpt';
import { buildCanvasFromAnalysis } from '../core/analysis/graph';
import { remapCooccurrences } from '../core/analysis/cooccurrence';
import { runPreprocess } from '../core/analysis/runPreprocess';
import type {
  AnalysisCharacter, AnalysisRelation, CandidateConfidence, Cooccurrence,
} from '../core/analysis/types';
import { clearProjectCreatedThisSession, markManualSaved } from '../core/save/flags';
import { useProjectStore } from '../stores/projectStore';
import type { ProjectSummary } from '../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const STEP_INDEX = { upload: 0, confirm: 1, analyzing: 2, preview: 3 } as const;
type WizardStep = keyof typeof STEP_INDEX;

const TEMPLATE_OPTIONS = [
  { value: 'default', label: '默认模板' },
  { value: 'xuanhuan', label: '玄幻修仙' },
  { value: 'wuxia', label: '武侠江湖' },
  { value: 'romance', label: '言情' },
];

const GENDER_OPTIONS = [{ value: '男' }, { value: '女' }, { value: '未知' }];

const CONFIDENCE_LABELS: Record<CandidateConfidence, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const CONFIDENCE_COLORS: Record<CandidateConfidence, string> = {
  high: 'green',
  medium: 'blue',
  low: 'default',
};

type CandidateRow = MergeableCandidate;

interface CharacterRow extends AnalysisCharacter {
  key: string;
}

interface RelationRow extends AnalysisRelation {
  key: string;
}

let rowKeySeed = 0;

function newRowKey(prefix: string) {
  rowKeySeed += 1;
  return `${prefix}-${rowKeySeed}`;
}

function fileStem(name: string) {
  return name.replace(/\.[^.]+$/, '').trim().slice(0, 100) || 'AI 提取项目';
}

function errorMessage(error: unknown) {
  const apiError = toApiError(error);
  if (apiError.code === 'ANALYSIS_NOT_CONFIGURED') {
    return `${apiError.message}。请在后端环境变量 DEEPSEEK_API_WEB 中配置密钥。`;
  }
  return apiError.message;
}

export function AnalysisPage() {
  const navigate = useNavigate();
  const createProject = useProjectStore((s) => s.create);
  const removeProject = useProjectStore((s) => s.remove);

  const [step, setStep] = useState<WizardStep>('upload');
  const [quota, setQuota] = useState<AnalysisQuota | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState('default');
  const [agreed, setAgreed] = useState(false);
  const [keepResult, setKeepResult] = useState(false);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [chapterCount, setChapterCount] = useState(0);
  const [encoding, setEncoding] = useState('');
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [projectName, setProjectName] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const textRef = useRef('');
  const cooccurrencesRef = useRef<Cooccurrence[]>([]);

  const refreshQuota = useCallback(async () => {
    try {
      setQuota(await getAnalysisQuota());
    } catch {
      setQuota(null);
    }
  }, []);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  const acceptFile = (next: File) => {
    if (!next.name.toLowerCase().endsWith('.txt')) {
      message.error('当前版本仅支持 .txt 小说文件');
      return;
    }
    if (next.size > MAX_FILE_SIZE) {
      message.error('小说文件不能超过 10MB');
      return;
    }
    setFile(next);
    setError('');
  };

  const startPreprocess = async () => {
    if (!file) {
      message.warning('请先选择小说文件');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await runPreprocess(file);
      textRef.current = result.text;
      cooccurrencesRef.current = result.cooccurrences;
      setChapterCount(result.chapterCount);
      setEncoding(result.encoding);
      setRows(
        result.candidates.map((candidate, index) => ({
          key: `candidate-${index}`,
          originalName: candidate.name,
          name: candidate.name,
          count: candidate.count,
          confidence: candidate.confidence,
          selected: true,
          aliases: candidate.aliases ?? [],
        })),
      );
      setProjectName(fileStem(file.name));
      setStep('confirm');
      if (result.candidates.length === 0) {
        message.warning('未自动识别到人物，请手动添加至少一个人物');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '本地解析失败');
    } finally {
      setBusy(false);
    }
  };

  const addCandidate = () => {
    setRows((current) => [
      ...current,
      {
        key: `manual-${Date.now()}`,
        originalName: '',
        name: '',
        count: 0,
        confidence: 'low',
        selected: true,
        aliases: [],
      },
    ]);
  };

  const mergeCandidates = (sourceKey: string, targetKey: string) => {
    setRows((current) => mergeCandidateRows(current, sourceKey, targetKey));
  };

  const updateCandidate = (key: string, patch: Partial<CandidateRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const selectedRows = rows.filter((row) => row.selected);

  const analyze = async () => {
    if (!file) {
      message.warning('请先选择小说文件');
      setStep('upload');
      return;
    }
    const selected = rows.filter((row) => row.selected);
    const names = selected.map((row) => row.name.trim());
    if (names.length === 0) {
      message.warning('请至少勾选一个人物');
      return;
    }
    if (names.some((name) => !name)) {
      message.warning('人物姓名不能为空');
      return;
    }
    if (new Set(names).size !== names.length) {
      message.warning('人物姓名不能重复');
      return;
    }

    setStep('analyzing');
    setBusy(true);
    setError('');
    try {
      const replacements: Record<string, string> = {};
      for (const row of selected) {
        const canonical = row.name.trim();
        if (row.originalName && row.originalName !== canonical) {
          replacements[row.originalName] = canonical;
        }
        for (const alias of row.aliases ?? []) {
          if (alias && alias !== canonical) replacements[alias] = canonical;
        }
      }
      const excerpt = buildExcerpt(
        textRef.current,
        selected.map((row) => row.originalName).filter(Boolean),
        { replacements },
      ) || textRef.current.slice(0, 12000);
      const confirmed = new Set(names);
      const cooccurrences = remapCooccurrences(cooccurrencesRef.current, replacements)
        .filter((pair) => confirmed.has(pair.a) && confirmed.has(pair.b));

      const job = await createAnalysisJob({
        fileName: file.name,
        fileSize: file.size,
        charCount: textRef.current.length,
        template,
        keepResult,
      });
      await saveAnalysisStructured(job.id, {
        candidates: selected.map((row) => ({
          name: row.name.trim(),
          count: row.count,
          confidence: row.confidence,
        })),
        cooccurrences,
        excerpt,
        chapterCount,
      });
      const response = await confirmAnalysis(job.id, names.map((name) => ({ name })));
      setJobId(job.id);
      setCharacters(response.result.characters.map((character) => ({
        ...character,
        key: newRowKey('character'),
      })));
      setRelations(response.result.relations.map((relation) => ({
        ...relation,
        key: newRowKey('relation'),
      })));
      setModel(response.result.model ?? '');
      setStep('preview');
      void refreshQuota();
    } catch (e) {
      setStep('confirm');
      setError(errorMessage(e));
      void refreshQuota();
    } finally {
      setBusy(false);
    }
  };

  const updateCharacter = (index: number, patch: Partial<CharacterRow>) => {
    setCharacters((current) =>
      current.map((character, itemIndex) =>
        itemIndex === index ? { ...character, ...patch } : character,
      ),
    );
  };

  const renameCharacter = (index: number, name: string) => {
    const previous = characters[index]?.name ?? '';
    updateCharacter(index, { name });
    setRelations((current) =>
      current.map((relation) => ({
        ...relation,
        from: relation.from === previous ? name : relation.from,
        to: relation.to === previous ? name : relation.to,
      })),
    );
  };

  const removeCharacter = (index: number) => {
    const name = characters[index]?.name ?? '';
    setCharacters((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setRelations((current) =>
      current.filter((relation) => relation.from !== name && relation.to !== name),
    );
  };

  const addCharacter = () => {
    let name = '新角色';
    let suffix = 1;
    while (characters.some((character) => character.name === name)) {
      suffix += 1;
      name = `新角色${suffix}`;
    }
    setCharacters((current) => [
      ...current,
      { key: newRowKey('character'), name, gender: '未知', description: '' },
    ]);
  };

  const updateRelation = (index: number, patch: Partial<RelationRow>) => {
    setRelations((current) =>
      current.map((relation, itemIndex) =>
        itemIndex === index ? { ...relation, ...patch } : relation,
      ),
    );
  };

  const removeRelation = (index: number) => {
    setRelations((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const reverseRelation = (index: number) => {
    const relation = relations[index];
    if (!relation) return;
    updateRelation(index, { from: relation.to, to: relation.from });
  };

  const addRelation = () => {
    const names = characters.map((character) => character.name.trim()).filter(Boolean);
    if (names.length < 2) {
      message.warning('至少需要两个已命名人物才能添加关系');
      return;
    }
    setRelations((current) => [
      ...current,
      { key: newRowKey('relation'), from: names[0], to: names[1], type: '朋友', confidence: 'medium' },
    ]);
  };

  const generate = async () => {
    const name = projectName.trim();
    if (!name) {
      message.warning('请填写项目名称');
      return;
    }
    if (characters.length === 0) {
      message.warning('至少需要一个人物');
      return;
    }
    const names = characters.map((character) => character.name.trim());
    if (names.some((item) => !item)) {
      message.warning('人物姓名不能为空');
      return;
    }
    if (new Set(names).size !== names.length) {
      message.warning('人物姓名不能重复');
      return;
    }
    const invalid = relations.some(
      (relation) => !relation.from || !relation.to || !names.includes(relation.from) || !names.includes(relation.to),
    );
    if (invalid) {
      message.warning('请检查关系两端是否仍为有效人物');
      return;
    }

    setBusy(true);
    setError('');
    let project: ProjectSummary | null = null;
    try {
      if (jobId && keepResult) {
        try {
          await updateAnalysisResult(jobId, { characters, relations });
        } catch (e) {
          message.warning(`修正结果保存失败：${toApiError(e).message}`);
        }
      }

      const finalCharacters = characters.map((character) => ({
        ...character,
        name: character.name.trim(),
      }));
      const finalRelations = relations.map((relation) => ({
        ...relation,
        from: relation.from.trim(),
        to: relation.to.trim(),
        type: relation.type.trim() || '关系',
      }));
      const state = buildCanvasFromAnalysis(
        { characters: finalCharacters, relations: finalRelations, model },
        finalCharacters.map((character) => character.name),
      );
      project = await createProject(name.slice(0, 100));
      await saveCanvas(project.id, state);
      markManualSaved(project.id);
      clearProjectCreatedThisSession(project.id);
      message.success('关系图已生成');
      navigate(`/project/${project.id}`);
    } catch (e) {
      if (project) {
        try {
          await removeProject(project.id);
        } catch {
          // 项目清理失败不阻断错误提示
        }
      }
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const nameOptions = characters
    .map((character, index) => ({
      value: character.name.trim(),
      label: character.name.trim() || `角色${index + 1}`,
    }))
    .filter((option) => option.value);

  const characterColumns: TableProps<CharacterRow>['columns'] = [
    {
      title: '姓名',
      dataIndex: 'name',
      width: 150,
      render: (_, _record, index) => (
        <Input
          value={characters[index]?.name ?? ''}
          maxLength={20}
          onChange={(event) => renameCharacter(index, event.target.value)}
        />
      ),
    },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 120,
      render: (_, record, index) => (
        <AutoComplete
          value={record.gender ?? '未知'}
          options={GENDER_OPTIONS}
          onChange={(value) => updateCharacter(index, { gender: value })}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '简介',
      dataIndex: 'description',
      render: (_, record, index) => (
        <Input.TextArea
          value={record.description ?? ''}
          autoSize={{ minRows: 1, maxRows: 3 }}
          maxLength={500}
          onChange={(event) => updateCharacter(index, { description: event.target.value })}
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_, _record, index) => (
        <Button type="link" danger onClick={() => removeCharacter(index)}>
          删除
        </Button>
      ),
    },
  ];

  const relationColumns: TableProps<RelationRow>['columns'] = [
    {
      title: '起点',
      dataIndex: 'from',
      width: 140,
      render: (_, record, index) => (
        <Select
          value={record.from || undefined}
          options={nameOptions}
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          onChange={(value) => updateRelation(index, { from: value })}
        />
      ),
    },
    {
      title: '终点',
      dataIndex: 'to',
      width: 140,
      render: (_, record, index) => (
        <Select
          value={record.to || undefined}
          options={nameOptions}
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          onChange={(value) => updateRelation(index, { to: value })}
        />
      ),
    },
    {
      title: '关系类型',
      dataIndex: 'type',
      width: 130,
      render: (_, record, index) => (
        <Input
          value={record.type}
          maxLength={40}
          onChange={(event) => updateRelation(index, { type: event.target.value })}
        />
      ),
    },
    {
      title: '关系说明',
      dataIndex: 'description',
      render: (_, record, index) => (
        <Input
          value={record.description ?? ''}
          maxLength={500}
          onChange={(event) => updateRelation(index, { description: event.target.value })}
        />
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: 100,
      render: (_, record, index) => (
        <Select
          value={record.confidence}
          allowClear
          placeholder="未知"
          style={{ width: '100%' }}
          options={[
            { value: 'high', label: '高' },
            { value: 'medium', label: '中' },
            { value: 'low', label: '低' },
          ]}
          onChange={(value) => updateRelation(index, { confidence: value })}
        />
      ),
    },
    {
      title: '操作',
      width: 130,
      render: (_, _record, index) => (
        <Space size={0}>
          <Button type="link" onClick={() => reverseRelation(index)}>
            反向
          </Button>
          <Button type="link" danger onClick={() => removeRelation(index)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          AI 小说提取
        </Typography.Title>
        <Space>
          {quota && (
            <Tag color={quota.remaining > 0 ? 'blue' : 'red'}>
              今日剩余 {quota.remaining}/{quota.limit} 次
            </Tag>
          )}
          <Button onClick={() => navigate('/')}>返回主界面</Button>
        </Space>
      </div>
      <Steps
        current={STEP_INDEX[step]}
        items={[
          { title: '上传小说' },
          { title: '确认人物' },
          { title: 'AI 分析' },
          { title: '预览生成' },
        ]}
        style={{ margin: '20px 0' }}
      />

      {error && (
        <Alert
          type="error"
          showIcon
          closable
          message="操作失败"
          description={error}
          style={{ marginBottom: 16 }}
          onClose={() => setError('')}
        />
      )}

      {step === 'upload' && (
        <Card>
          <Alert
            type="info"
            showIcon
            message="隐私与版权"
            description={[
              '请确保您拥有上传小说的合法权利，不要上传盗版或侵权内容；分析结果仅供个人学习使用。',
              '小说全文只在浏览器本地解码与识别人名，不会上传到服务器；服务端只接收确认后的人物、共现线索与有限片段，不保存原文。',
              '默认分析完成后不保存结果；勾选“保存分析结果”后，结构化结果会保留 30 天。',
            ].join(' ')}
            style={{ marginBottom: 16 }}
          />
          <Upload.Dragger
            accept=".txt"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(next) => {
              acceptFile(next);
              return false;
            }}
          >
            <p style={{ fontSize: 20, margin: '12px 0' }}>点击或拖入 .txt 小说文件</p>
            <p style={{ color: '#888', margin: 0 }}>支持 UTF-8 / GBK 编码，最大 10MB；MVP 暂不支持 EPUB/PDF</p>
          </Upload.Dragger>
          {file && (
            <div style={{ marginTop: 12 }}>
              已选择：{file.name}（{(file.size / 1024).toFixed(1)} KB）
              <Button type="link" onClick={() => setFile(null)}>
                移除
              </Button>
            </div>
          )}
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
            <Space wrap>
              <Typography.Text>小说类型</Typography.Text>
              <Select
                value={template}
                options={TEMPLATE_OPTIONS}
                onChange={setTemplate}
                style={{ width: 180 }}
              />
            </Space>
            <Checkbox checked={keepResult} onChange={(event) => setKeepResult(event.target.checked)}>
              保存分析结果以便后续编辑（保留 30 天）
            </Checkbox>
            <Checkbox checked={agreed} onChange={(event) => setAgreed(event.target.checked)}>
              我已阅读并同意以上声明，确认拥有上传该小说的合法权利
            </Checkbox>
            {quota?.remaining === 0 && (
              <Typography.Text type="danger">今日 AI 分析次数已用完，请明天再试。</Typography.Text>
            )}
            <Button
              type="primary"
              loading={busy}
              disabled={!file || !agreed || quota?.remaining === 0}
              onClick={() => void startPreprocess()}
            >
              {busy ? '正在本地解析…' : '开始解析'}
            </Button>
          </Space>
        </Card>
      )}

      {step === 'confirm' && (
        <Card>
          <Alert
            type="success"
            showIcon
            message={`已识别 ${rows.length} 位候选人物`}
            description={`章节数 ${chapterCount} · 编码 ${encoding.toUpperCase()}。请勾选确认并修正姓名；未识别到的人物可手动添加。`}
          />
          <Space wrap style={{ margin: '12px 0' }}>
            <Button onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: true })))}>
              全选
            </Button>
            <Button onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: false })))}>
              清空
            </Button>
            <Button onClick={addCandidate}>手动添加人物</Button>
          </Space>
          <Table<CandidateRow>
            rowKey="key"
            size="small"
            pagination={false}
            scroll={{ y: 360 }}
            dataSource={rows}
            rowSelection={{
              selectedRowKeys: selectedRows.map((row) => row.key),
              onChange: (keys) =>
                setRows((current) =>
                  current.map((row) => ({ ...row, selected: keys.includes(row.key) })),
                ),
            }}
            columns={[
              {
                title: '姓名',
                dataIndex: 'name',
                render: (_, record) => (
                  <div>
                    <Input
                      value={record.name}
                      maxLength={20}
                      placeholder="人物姓名"
                      onChange={(event) => updateCandidate(record.key, { name: event.target.value })}
                    />
                    {!!record.aliases?.length && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        别名：{record.aliases.join('、')}
                      </Typography.Text>
                    )}
                  </div>
                ),
              },
              { title: '出现次数', dataIndex: 'count', width: 100 },
              {
                title: '置信度',
                dataIndex: 'confidence',
                width: 100,
                render: (value: CandidateConfidence) => (
                  <Tag color={CONFIDENCE_COLORS[value]}>{CONFIDENCE_LABELS[value]}</Tag>
                ),
              },
              {
                title: '操作',
                width: 220,
                render: (_, record) => (
                  <Space size={0}>
                    <Select
                      size="small"
                      placeholder="合并到"
                      style={{ width: 120 }}
                      showSearch
                      optionFilterProp="label"
                      options={rows
                        .filter((row) => row.key !== record.key && row.name.trim())
                        .map((row) => ({ value: row.key, label: row.name.trim() }))}
                      onChange={(targetKey) => mergeCandidates(record.key, targetKey)}
                    />
                    <Button
                      type="link"
                      danger
                      onClick={() =>
                        setRows((current) => current.filter((row) => row.key !== record.key))
                      }
                    >
                      移除
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
          <Space style={{ marginTop: 16 }}>
            <Button onClick={() => setStep('upload')} disabled={busy}>
              上一步
            </Button>
            <Button type="primary" loading={busy} onClick={() => void analyze()}>
              开始 AI 分析
            </Button>
            <Typography.Text type="secondary">
              已勾选 {selectedRows.length} 人；AI 只分析这些人物之间的关系。
            </Typography.Text>
          </Space>
        </Card>
      )}

      {step === 'analyzing' && (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            AI 正在分析人物关系
          </Typography.Title>
          <Typography.Text type="secondary">
            通常需要 10–30 秒，请不要关闭页面。
          </Typography.Text>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <Alert
            type="success"
            showIcon
            message={`分析完成：${characters.length} 位人物，${relations.length} 条关系`}
            description={model ? `模型：${model}。可继续修正人物与关系后再生成关系图。` : '可继续修正人物与关系后再生成关系图。'}
          />
          <Space style={{ marginTop: 16 }}>
            <Typography.Text strong>项目名称</Typography.Text>
            <Input
              value={projectName}
              maxLength={100}
              style={{ width: 360 }}
              onChange={(event) => setProjectName(event.target.value)}
            />
          </Space>

          <Card
            size="small"
            title="人物"
            style={{ marginTop: 16 }}
            extra={<Button size="small" onClick={addCharacter}>添加人物</Button>}
          >
            <Table<CharacterRow>
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={characters}
              columns={characterColumns}
              scroll={{ x: 640 }}
            />
          </Card>

          <Card
            size="small"
            title="关系"
            style={{ marginTop: 16 }}
            extra={<Button size="small" onClick={addRelation}>添加关系</Button>}
          >
            <Table<RelationRow>
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={relations}
              columns={relationColumns}
              scroll={{ x: 900 }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="AI 未识别到关系，可手动添加"
                  />
                ),
              }}
            />
          </Card>

          <Space style={{ marginTop: 16 }}>
            <Button type="primary" loading={busy} onClick={() => void generate()}>
              生成关系图
            </Button>
            <Typography.Text type="secondary">
              生成后会创建一个新项目，并自动保存为当前账号的云端项目。
            </Typography.Text>
          </Space>
        </Card>
      )}
    </div>
  );
}
