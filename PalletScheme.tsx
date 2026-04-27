import type { RowType } from "@/lib/pallet-calc";
import { FIRST_4M_ROWS } from "@/lib/pallet-calc";

type Props = {
  scheme: RowType[];
};

export function PalletScheme({ scheme }: Props) {
  if (scheme.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide text-foreground">
          Loading scheme
        </span>
        <span>← Front (drive axle)</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {scheme.map((row, i) => {
          const inFirst4m = i < FIRST_4M_ROWS;
          return (
            <div
              key={i}
              className={flex items-center gap-2 ${inFirst4m ? "" : ""}}
            >
              <div className="w-6 text-right text-xs font-mono text-muted-foreground">
                {i + 1}
              </div>
              <div
                className={`flex flex-1 gap-1 rounded-md p-1.5 ${
                  inFirst4m
                    ? "bg-accent/60 ring-1 ring-primary/30"
                    : "bg-muted/40"
                }`}
              >
                {row === "single" ? (
                  <div className="mx-auto flex h-8 w-1/2 items-center justify-center rounded bg-warning text-xs font-bold text-warning-foreground">
                    SINGLE
                  </div>
                ) : (
                  <>
                    <div className="flex h-8 flex-1 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                      PLL
                    </div>
                    <div className="flex h-8 flex-1 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                      PLL
                    </div>
                  </>
                )}
              </div>
              {i === FIRST_4M_ROWS - 1 && (
                <div className="w-12 text-[10px] font-semibold text-primary">
                  4 m ↑
                </div>
              )}
              {i !== FIRST_4M_ROWS - 1 && <div className="w-12" />}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-primary" /> Double row
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-warning" /> Single (centered crosswise)
        </div>
      </div>
    </div>
  );
}
