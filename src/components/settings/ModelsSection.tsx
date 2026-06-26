import { useEffect } from 'react';
import { useSettingsStore, AVAILABLE_MODELS } from '../../lib/stores/settings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';

interface ModelRowProps {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}

function ModelRow({ label, description, value, onChange }: ModelRowProps) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-72">
          <SelectValue placeholder="Selecione um modelo" />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_MODELS.map((model) => (
            <SelectItem key={model.value} value={model.value}>
              {model.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ModelsSection() {
  const {
    chatModel,
    agentsModel,
    benchmarkModel,
    setChatModel,
    setAgentsModel,
    setBenchmarkModel,
    load,
  } = useSettingsStore();

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Modelos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione o modelo padrão para cada tipo de tarefa.
        </p>
      </div>
      <Separator />
      <div className="space-y-8">
        <ModelRow
          label="Chat"
          description="Modelo usado nas conversas do módulo Chat"
          value={chatModel}
          onChange={(v) => setChatModel(v as any)}
        />
        <Separator />
        <ModelRow
          label="Agentes"
          description="Modelo usado pelos agentes e automações"
          value={agentsModel}
          onChange={(v) => setAgentsModel(v as any)}
        />
        <Separator />
        <ModelRow
          label="Benchmark"
          description="Modelo padrão nos comparativos lado a lado"
          value={benchmarkModel}
          onChange={(v) => setBenchmarkModel(v as any)}
        />
      </div>
    </div>
  );
}
