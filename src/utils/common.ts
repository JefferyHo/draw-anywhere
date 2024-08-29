export const throtte = <T extends (...args: any[]) => any>(fn: T, delay: number): T => {

  let lastExecTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null;

  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    const currentTime = Date.now();

    if (currentTime - lastExecTime >= delay) {
      lastExecTime = currentTime;
      fn.apply(context, args);
    } else if (!timeoutId) {
      const remainTime = delay - (currentTime - lastExecTime)

      timeoutId = setTimeout(() => {
        lastExecTime = Date.now();
        timeoutId = null;
        fn.apply(context, args);
      }, remainTime);
    }
  } as T;
}

export const randomNumber = (max: number, min: number, precision: number = 0): number => {
  const v = Math.random() * (max - min) + min;
  if (precision <= 0) return v >> 0;
  return Math.round(v * Math.pow(10, precision)) / Math.pow(10, precision);
}