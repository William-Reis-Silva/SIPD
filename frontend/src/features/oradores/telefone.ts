export function normalizarTelefone(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '');

  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    return digitos;
  }
  return null;
}

export function formatarTelefone(normalizado: string): string {
  const semPais = normalizado.startsWith('55') ? normalizado.slice(2) : normalizado;
  const ddd = semPais.slice(0, 2);
  const resto = semPais.slice(2);

  if (resto.length === 9) {
    return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
  }
  if (resto.length === 8) {
    return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  }
  return normalizado;
}
