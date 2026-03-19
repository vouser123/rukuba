export function mapVocabTermsToOptions(terms = [], { includeDefinition = true } = {}) {
  return (terms ?? []).map((term) => {
    const code = term?.code ?? '';
    const definition = term?.definition ?? '';

    return {
      value: code,
      label: includeDefinition && definition ? `${code} - ${definition}` : code,
    };
  });
}
