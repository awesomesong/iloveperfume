export const prioritizeArray = <T, K extends keyof T>(arr: T[], key: K, value: T[K]): T[] => {
  const matched = arr?.filter(item => item[key] === value);
  const others = arr?.filter(item => item[key] !== value);
  return matched ? [...matched, ...others] : [];
};