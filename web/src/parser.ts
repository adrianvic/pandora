export class Parser {
    input: string;
    
    constructor(input: string) {
        this.input = input;
    }
    
    parse(token: string, to: string): Parser {
        const esc = Parser.escapeRegex(token);
        
        const regex = new RegExp(`(^|\\s)${esc}(.+?)${esc}(?=\\s|$)`, "gs");
        
        this.input = this.input.replace(regex, (match, pre, inner) => {
            return `${pre}${to.replace("$1", inner)}`;
        });
        
        return this;
    }
    
    replace(searchValue: string, replaceValue: string): Parser {
        this.input = this.input.replaceAll(searchValue, replaceValue);
        return this;
    }
    
    static escapeRegex(string: string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}