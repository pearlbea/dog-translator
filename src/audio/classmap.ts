/** Parses yamnet_class_map.csv (index,mid,display_name) into display names by index. */
export function parseClassNames(csv: string): string[] {
  const names: string[] = [];
  // The upstream file uses CRLF line endings.
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const m = line.match(/^\d+,[^,]+,(.*)$/);
    if (!m) continue;
    names.push(m[1]!.replace(/^"|"$/g, "").trim());
  }
  return names;
}
