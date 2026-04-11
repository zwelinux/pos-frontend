export function formatModifierLabel(modifier) {
  const qty = Number(modifier?.qty || 1);
  const prefix = modifier?.include ? "" : "No ";
  return `${prefix}${modifier?.option_name || ""}${qty > 1 ? ` x${qty}` : ""}`;
}

export function groupModifiersForDisplay(modifiers = [], fallbackTitle = "Options") {
  return modifiers.reduce((groups, modifier, index) => {
    const showTitle = modifier?.show_title !== false;
    const title = modifier?.group_name || fallbackTitle;
    const key = showTitle ? title : `__hidden__${index}`;

    if (!groups[key]) {
      groups[key] = {
        key,
        title: showTitle ? title : null,
        items: [],
      };
    }

    groups[key].items.push({
      key: `${modifier?.option_id ?? index}-${index}`,
      label: formatModifierLabel(modifier),
      modifier,
    });
    return groups;
  }, {});
}
