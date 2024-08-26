const toTwo = (num: number) => (num < 10 ? '0' : '') + num;

const time = () => {
  const date = new Date();

  return toTwo(date.getHours()) 
    + ':' +
    toTwo(date.getMinutes())
    + ':' +
    toTwo(date.getSeconds())
    + ':' +
    date.getMilliseconds();
}


const logger = (moduleName: string = 'live') => {
  const logLevel = import.meta.env.VITE_LOG_LEVEL;
  const appName = import.meta.env.VITE_LOG_NAME;

  const log = (...args: any[]) => {
    const [type = 'log', ...rest] = args;

    if (type === 'error') {
      console.error(`${time()}%c ${appName}e%c [${moduleName}] ${rest.join(' ')}`, 'color: #64B5F6;', '');
    }

    if (logLevel >= 1) {
      if (type === 'warn') {
        console.warn(`${time()}%c ${appName}e%c [${moduleName}] ${rest.join(' ')}`, 'color: #64B5F6;', '');
      }
    }

    if (logLevel >= 2) {
      if (type === 'log') {
        console.log(`${time()}%c ${appName}e%c [${moduleName}] ${rest.join(' ')}`, 'color: #64B5F6;', '');
      }
      if (type === 'success') {
        console.info(`${time()}%c ${appName}e%c [${moduleName}] ${rest.join(' ')}`, 'color: #64B5F6;', '');
      }
    }

    if (logLevel >= 3) { 
      if (type === 'debug') {
        console.log(`${time()}%c ${appName}e [debug]%c [${moduleName}] ${rest.join(' ')}`, 'color: #64B5F6;', '');
      }
    }
  };

  return {
    info: (...args: any[]) => log('log', ...args),
    error: (...args: any[]) => log('error', ...args),
    warn: (...args: any[]) => log('warn', ...args),
    success: (...args: any[]) => log('success', ...args),
    debug: (...args: any[]) => log('debug', ...args),
  };
};

export default logger;