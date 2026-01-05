declare module 'xml-js' {
       export function xml2js(xml: string, options?: any): any;
       export function js2xml(js: any, options?: any): string;
   }