import { useEffect } from 'react';
import { useAppearance, ACCENT_COLORS } from '../../lib/stores/appearance';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';

/** Toggle-button group item (no @radix-ui/react-toggle needed) */
function ToggleButton({
  pressed,
  onClick,
  children,
  'aria-label': ariaLabel,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5',
        'text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        pressed
          ? 'border-primary bg-primary/10 text-primary'
          : 'bg-transparent text-foreground hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}

export function AppearanceSection() {
  const { theme, fontScale, accentColor, setTheme, setFontScale, setAccentColor, load } =
    useAppearance();

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Aparência</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize a aparência visual do NexusAI.
        </p>
      </div>
      <Separator />

      {/* D-07 Control 1: Light/dark theme toggle */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Tema</Label>
        <div className="flex gap-2" role="group" aria-label="Seleção de tema">
          <ToggleButton pressed={theme === 'light'} onClick={() => setTheme('light')}>
            Claro
          </ToggleButton>
          <ToggleButton pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
            Escuro
          </ToggleButton>
        </div>
      </div>

      <Separator />

      {/* D-07 Control 2: Font scale selector */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Tamanho de fonte</Label>
        <div className="flex gap-2" role="group" aria-label="Tamanho de fonte">
          {(
            [
              { value: 'sm', label: 'Pequeno' },
              { value: 'md', label: 'Médio' },
              { value: 'lg', label: 'Grande' },
            ] as const
          ).map(({ value, label }) => (
            <ToggleButton
              key={value}
              pressed={fontScale === value}
              onClick={() => setFontScale(value)}
            >
              {label}
            </ToggleButton>
          ))}
        </div>
      </div>

      <Separator />

      {/* D-07 Control 3: Accent color picker — D-08: exactly 5 predefined swatches */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Cor de destaque</Label>
        <div className="flex gap-3" role="group" aria-label="Cor de destaque">
          {ACCENT_COLORS.map(({ value, label, hsl }) => (
            <button
              key={value}
              type="button"
              onClick={() => setAccentColor(value)}
              aria-label={label}
              aria-pressed={accentColor === value}
              data-accent={value}
              className={cn(
                'h-7 w-7 rounded-full transition-transform hover:scale-110',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                accentColor === value && 'ring-2 ring-offset-2 ring-primary scale-110'
              )}
              style={{ backgroundColor: hsl }}
              title={label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
