export const extractFieldsWithTags = (text, tags, delimiter = '\n\n') => {
  const result = {};

  tags.forEach((tag, index) => {
    const matches = [];
    const tagRegex = new RegExp(
      `<${tag}>([\\s\\S]*?)<\/${tag}>|<${tag}>([\\s\\S]*?)(<${tags.slice(index + 1).join('|<')}|$)`,
      'g'
    );
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
      let content = '';

      if (match[1]) {
        content = match[1].trim();
      } else if (match[2]) {
        content = match[2].trim();
        if (match[3] && !match[3].startsWith(`</${tag}>`)) {
          const nextTagIndex = text.indexOf(match[3], match.index + match[0].length);
          if (nextTagIndex !== -1) {
            content = text.substring(match.index + `<${tag}>`.length, nextTagIndex).trim();
          }
        } else {
          content = text.substring(match.index + `<${tag}>`.length).trim();
        }
      }

      matches.push(content);
    }

    result[tag] = matches.length > 0 ? matches.join(delimiter) : 'Not found';
  });

  return result;
};
