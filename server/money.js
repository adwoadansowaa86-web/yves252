// All money is stored as integer pesewas (1 GH₵ = 100 pesewas) to avoid
// floating-point rounding errors. Convert only at the edges.

export const toPesewas = (cedis) => Math.round(Number(cedis) * 100);
export const toCedis = (pesewas) => Number((pesewas / 100).toFixed(2));
