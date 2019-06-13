export const parseQueryString = (text) => {
  const sanatisedText = text.replace('?', '');
  const splitText = sanatisedText.split('&');
  return splitText.reduce((acc, c) => {
    const kv = c.split('=');
    if (kv.length < 2) return acc;
    return { ...acc, [kv[0]]: kv[1] };
  }, {});
}
