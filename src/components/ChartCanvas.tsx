import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    Chart?: any;
  }
}

interface ChartCanvasProps {
  id: string;
  config: Record<string, unknown>;
  height?: number;
  ariaLabel: string;
}

export function ChartCanvas({ id, config, height = 280, ariaLabel }: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ChartCtor = window.Chart;
    if (!canvas || !ChartCtor) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new ChartCtor(ctx, config);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [config]);

  return (
    <div style={{ position: 'relative', height: `${height}px`, width: '100%' }}>
      <canvas
        ref={canvasRef}
        id={id}
        data-testid={id}
        aria-label={ariaLabel}
        role="img"
      />
    </div>
  );
}
