export const createLogger = (tag: string) => {
  return (input: any) => {
    const date = new Date();
    // tslint:disable-next-line:no-console
    console.log(`${date.toLocaleString()} ${tag}: ${input}`);
  };
};
