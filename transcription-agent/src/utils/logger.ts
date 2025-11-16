/**
 * Centralized logging utility
 */

export class Logger {
  log(emoji: string, category: string, message: string, ...args: any[]) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${emoji} [${timestamp}] [${category}]`, message, ...args);
  }

  info(category: string, message: string, ...args: any[]) {
    this.log('ℹ️', category, message, ...args);
  }

  success(category: string, message: string, ...args: any[]) {
    this.log('✅', category, message, ...args);
  }

  error(category: string, message: string, ...args: any[]) {
    this.log('❌', category, message, ...args);
  }

  warn(category: string, message: string, ...args: any[]) {
    this.log('⚠️', category, message, ...args);
  }

  debug(category: string, message: string, ...args: any[]) {
    this.log('🔍', category, message, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();
