export const extractFieldsWithTags = (text, tags, delimiter = '\n\n') => {
  const result = {};

  tags.forEach((tag) => {
    const matches = [];
    let regex = new RegExp(`<${tag}>([\\s\\S]*?)(<\/${tag}>|<|$)`, 'g');
    let match;

    while ((match = regex.exec(text)) !== null) {
      let content = match[1].trim();

      if (!match[2] || !match[2].startsWith(`</${tag}>`)) {
        const nextTagStart = text.substring(match.index + match[0].length).search(/<[^\/][^>]*>/);
        if (nextTagStart !== -1) {
          content = text
            .substring(match.index + match[0].length - match[1].length, match.index + match[0].length + nextTagStart)
            .trim();
        } else {
          content = text.substring(match.index + match[0].length - match[1].length).trim();
        }
      }

      matches.push(content);
    }

    result[tag] = matches.length > 0 ? matches.join(delimiter) : 'Not found';
  });

  return result;
};
