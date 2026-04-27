Pallet-calc
// Kreiss EUR pallet loading calculator
// Source: PLL_2.pptx + Pallets_layout_first_4_11_12_13m.docx

export const MAX_CARGO_KG = 22500;
export const EUR_FULL_LOAD = 32; // for SINGLEs distribution we treat full = 32

export type TrailerLength = 11 | 12 | 13;

export const TRAILER_SPECS: Record<TrailerLength, { rows: number; hMax: number }> = {
  11: { rows: 14, hMax: 5500 },
  12: { rows: 15, hMax: 6000 },
  13: { rows: 16, hMax: 6500 },
};

export const FIRST_4M_ROWS = 5;

export type RowType = "single" | "double";

export type CalcInput = {
  cargoKg: number;
  pallets: number;
  trailer: TrailerLength;
};

export type CalcResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  onePalletKg: number;
  singlesNeeded: number;
  rowsUsed: number;
  scheme: RowType[]; // first row is the FRONT (drive-axle side)
  palletsInFirst4m: number;
  hAct: number; // kg in first 4m
  hMin: number; // 25% of cargo
  hMax: number; // from trailer length
  safe: boolean;
  safetyReason: string;
};

/**
 * Build a row scheme that:
 *  - has rows rows total
 *  - has singles single rows and (rows - singles) double rows
 *  - row 1 is SINGLE (front, by drive axle, per docs)
 *  - last row is DOUBLE
 *  - no two consecutive singles
 * If constraints can't be met, returns null.
 */
export function buildScheme(rows: number, singles: number): RowType[] | null {
  if (singles < 0 || singles > rows) return null;
  const doubles = rows - singles;
  // Need at least one double after each single (no consecutive singles) and last must be double.
  // Place singles at positions 1, then spaced. Simplest: max singles allowed = ceil(rows/2) but
  // since last must be double, max singles = floor(rows/2).
  if (singles > Math.floor(rows / 2)) return null;
  if (doubles < 1) return null;

  const scheme: RowType[] = new Array(rows).fill("double");
  if (singles === 0) return scheme;

  // Row 1 is single (front). Then distribute remaining singles evenly among remaining rows
  // such that no two singles are adjacent and last row stays double.
  scheme[0] = "single";
  const remaining = singles - 1;
  if (remaining === 0) return scheme;

  // Available slots: indices 2..rows-2 (0-based: 2..rows-2), keep last (rows-1) as double,
  // and don't use index 1 (would be adjacent to row 1 single).
  const slots: number[] = [];
  for (let i = 2; i <= rows - 2; i++) slots.push(i);
  if (slots.length < remaining) return null;

  // Even spacing
  const step = slots.length / remaining;
  const chosen = new Set<number>();
  for (let k = 0; k < remaining; k++) {
    let idx = Math.round((k + 0.5) * step) - 1;
    if (idx < 0) idx = 0;
    if (idx >= slots.length) idx = slots.length - 1;
    // Ensure not adjacent to an already-chosen single
    let pos = slots[idx];
    let tries = 0;
    while (
      (chosen.has(pos) ||
        scheme[pos - 1] === "single" ||
        (pos + 1 < rows && scheme[pos + 1] === "single")) &&
      tries < slots.length
    ) {
      idx = (idx + 1) % slots.length;
      pos = slots[idx];
      tries++;
    }
    if (chosen.has(pos)) return null;
    chosen.add(pos);
    scheme[pos] = "single";
  }

  // Final validation
  if (scheme[scheme.length - 1] !== "double") return null;
  for (let i = 1; i < scheme.length; i++) {
    if (scheme[i] === "single" && scheme[i - 1] === "single") return null;
  }
  return scheme;
}

export function calculate(input: CalcInput): CalcResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { cargoKg, pallets, trailer } = input;

  if (!Number.isFinite(cargoKg) || cargoKg <= 0)
    errors.push("Enter a valid cargo weight.");
  if (cargoKg > MAX_CARGO_KG)
    errors.push(Cargo exceeds maximum ${MAX_CARGO_KG} kg.);
  if (cargoKg > 0 && cargoKg < 16000)
    warnings.push(
      "Load is lighter than 16 t — drive axle may be insufficiently loaded (per Kreiss note).",
    );
  if (!Number.isInteger(pallets) || pallets < 24 || pallets > 32)
    errors.push("Pallet count must be between 24 and 32.");

  const spec = TRAILER_SPECS[trailer];
  const rowsCap = spec.rows;
  // Each row holds 1 (single) or 2 (double) pallets. Need rows R with singles S where
  // S + 2*(R-S) = pallets  =>  S = 2R - pallets.
  // Choose smallest valid R: ceil(pallets/2) <= R <= rowsCap, and S even-distributable.
  let chosenRows = 0;
  let singles = 0;
  let scheme: RowType[] | null = null;
  if (errors.length === 0) {
    const minRows = Math.ceil(pallets / 2);
    if (minRows > rowsCap) {
      errors.push(
        ${pallets} pallets do not fit in ${trailer} m (max ${rowsCap} rows = ${rowsCap * 2} pallets).,
      );
    } else {
      // Prefer using the FULL trailer length (rowsCap) to spread load — this matches the doc:
      // "SINGLEs spread the load over the entire length of the trailer".
      for (let r = rowsCap; r >= minRows; r--) {
        const s = 2 * r - pallets;
        const built = buildScheme(r, s);
        if (built) {
          chosenRows = r;
          singles = s;
          scheme = built;
          break;
        }
      }
      if (!scheme) {
        errors.push(
          "Cannot build a valid row scheme for these inputs (single/double placement rules).",
        );
      }
    }
  }

  const onePalletKg = pallets > 0 ? cargoKg / pallets : 0;
  const singlesNeeded = EUR_FULL_LOAD - pallets; // per docs formula
  const hMin = cargoKg * 0.25;
  const hMax = spec.hMax;

  let palletsInFirst4m = 0;
  if (scheme) {
    for (let i = 0; i < FIRST_4M_ROWS && i < scheme.length; i++) {
      palletsInFirst4m += scheme[i] === "single" ? 1 : 2;
    }
  }
  const hAct = palletsInFirst4m * onePalletKg;

  let safe = false;
  let safetyReason = "";
  if (errors.length === 0 && scheme) {
    if (hAct > hMax) {
      safetyReason = NOT SAFE — Hact (${Math.round(hAct)} kg) exceeds Hmax (${hMax} kg). Reduce pallets in the first 4 m.;
    } else if (hAct < hMin) {
      safetyReason = NOT SAFE — Hact (${Math.round(hAct)} kg) is below Hmin 25% (${Math.round(hMin)} kg). Drive axle under-loaded.;
    } else {
      safe = true;
      safetyReason = SAFE — Hact (${Math.round(hAct)} kg) is between Hmin (${Math.round(hMin)} kg) and Hmax (${Math.round(hMax)} kg).;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    onePalletKg,
    singlesNeeded,
    rowsUsed: chosenRows,
    scheme: scheme ?? [],
    palletsInFirst4m,
    hAct,
    hMin,
    hMax,
    safe,
    safetyReason,
  };
}
