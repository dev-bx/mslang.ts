import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
    StackVariable, VariableType, StackVariableBoolean, StackVariableNumber, CodeLexer, CodeParser,
    LexerTypeArray, Interpreter, ContextInterpreter, LexerType, StackVariableArray, StackVariableString,
    StackVariableObject, ParseNode, MSLangException, Script, ParsedScript, FunctionParameter
} from "../src";

class FieldsObject extends StackVariable {
    constructor() {
        super(VariableType.vtObject, true);
    }

    getProperty(name: string) {
        if (name === 'YesNo2') {
            return new StackVariableBoolean(true, false);
        }

        return undefined;
    }
}

class TestObject extends StackVariable {
    private objProperties: Record<string, StackVariable> | null = null;

    constructor() {
        super(VariableType.vtObject, true);
    }

    private initProperties() {
        this.objProperties = {
            'Number1': new StackVariableNumber(true, 10),
            'Number2': new StackVariableNumber(true, 20),
            'Number3': new StackVariableNumber(true, 30),
        };
    }

    getProperty(name: string) {
        if (!this.objProperties) this.initProperties();
        return this.objProperties && name in this.objProperties ? this.objProperties[name] : undefined;
    }

    setProperty(name: string, value: StackVariable) {
        if (!this.objProperties) this.initProperties();
        if (this.objProperties) this.objProperties[name] = value;
    }
}

function createCodeContext(text: string) {
    const lexer = new CodeLexer(text);
    const parser = new CodeParser(lexer);

    const nodeList: ParseNode[] = [];

    parser.parseCode(nodeList, true, true, LexerTypeArray.one(LexerType.ltEof));

    const interpreter = new Interpreter();
    interpreter.registerHandlers();

    const context = new ContextInterpreter(nodeList, interpreter);
    context.registerConst();

    return context;
}

function executeReturnCode(text: string) {
    return createCodeContext(text).exec(true);
}

test('001', (t) => {
    assert.throws(function () {
        const lexer = new CodeLexer('return true;');
        const parser = new CodeParser(lexer);

        const nodeList: ParseNode[] = [];

        parser.parseCode(nodeList, true, true, new LexerTypeArray());

        const interpreter = new Interpreter();
        interpreter.registerHandlers();

        const context = new ContextInterpreter(nodeList, interpreter);
        context.registerConst();

        context.exec(true);

    }, 'ltEof')
});

test('002', (t) => {

    const returnVal = executeReturnCode('return true;');

    assert.strictEqual(true, returnVal?.value);
});

test('003', (t) => {
    const returnVal = executeReturnCode('return 0 == 0;');

    assert.strictEqual(true, returnVal?.value);
});

test('004', (t) => {
    const returnVal = executeReturnCode('return (4 / 2) + 5;');

    assert.strictEqual(7, returnVal?.value);
});

test('005', (t) => {
    const returnVal = executeReturnCode('return 7 == 7');

    assert.strictEqual(true, returnVal?.value);
});

test('006', (t) => {
    const returnVal = executeReturnCode('return 7 - 2 ==  5');

    assert.strictEqual(true, returnVal?.value);
});

test('007', (t) => {
    const returnVal = executeReturnCode('return "a"+"b"+(7*2).toString()');

    assert.strictEqual('ab14', returnVal?.value);
});

test('008', (t) => {
    const returnVal = executeReturnCode('return 1+1+2 == 2*1 == true;');

    assert.strictEqual(false, returnVal?.value);
});

test('009', (t) => {
    const returnVal = executeReturnCode('return 4 == 2 == true;');

    assert.strictEqual(false, returnVal?.value);
});

test('010', (t) => {
    const returnVal = executeReturnCode('return 1+1+2 == 2*2 == true;');

    assert.strictEqual(true, returnVal?.value);
});

test('011', (t) => {
    const returnVal = executeReturnCode('a = 0; for (i=0;i<10;i++;) a=a+1; return a;');

    assert.strictEqual(10, returnVal?.value);
});

test('012', (t) => {
    const context = createCodeContext('return !Fields.YesNo2;');

    context.setVariable('Fields', new FieldsObject());

    const returnVal = context.exec(true);

    assert.strictEqual(true, returnVal?.value);
});

test('013', (t) => {
    const returnVal = executeReturnCode('return !!!!!!!!!!!!!!!!!!!(10>10)');

    assert.strictEqual(true, returnVal?.value);
});

test('014', (t) => {
    const returnVal = executeReturnCode('return "Test".ToUpper().Contains("TEST");');

    assert.strictEqual(true, returnVal?.value);
});

test('015', (t) => {
    const context = createCodeContext(`a = 10;


`);

    const returnVal = context.exec(true);

    assert.strictEqual(true, context.getVariable('a') instanceof StackVariable);
    assert.strictEqual(10, context.getVariable('a')?.value);
    assert.strictEqual(VariableType.vtVoid, returnVal?.type);
});

test('016', (t) => {
    const context = createCodeContext('return Fields.Number1*(Fields.Number2-Fields.Number3)*Fields.Number1;');

    context.setVariable('Fields', new TestObject());

    const returnVal = context.exec(true);

    assert.strictEqual(-1000, returnVal?.value);
});

test('017', (t) => {
    const returnVal = executeReturnCode(`
        a=0;
for (a=10;a>0;a--)
{
}
return a;
`);

    assert.strictEqual(0, returnVal?.value);
});

test('018', (t) => {
    const context = createCodeContext('return DateTime.Now;');

    const returnVal = context.exec(true);

    const diffValue = (Math.round((new Date()).getTime() / 1000)) - ((returnVal as unknown as StackVariableNumber).value as number);

    assert.strictEqual(true, diffValue === 0 || diffValue === 1);
});

test('019', (t) => {
    let returnVal;

    returnVal = executeReturnCode('a = 10; return a.ToString();');
    assert.strictEqual('10', returnVal?.value);

    returnVal = executeReturnCode('a = 10; return a.ToString()+"5";');
    assert.strictEqual('105', returnVal?.value);

    returnVal = executeReturnCode('a = 10; return (a*10).ToString()+"5";');
    assert.strictEqual('1005', returnVal?.value);

    returnVal = executeReturnCode('return (10).ToString();');
    assert.strictEqual('10', returnVal?.value);

});

test('020', (t) => {

    try {
        executeReturnCode('a = ""; b = a.Trim; return b();');
    } catch (e) {
        assert.strictEqual('Trim called on null or undefined', (e as Error).message);
    }
});

test('021', (t) => {
    let returnVal;

    returnVal = executeReturnCode('a = "abcdef"; return a.EndsWith("f");');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.EndsWith("z");');
    assert.strictEqual(false, returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.StartsWith("a");');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.StartsWith("z");');
    assert.strictEqual(false, returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.Contains("c");');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.Contains("z");');
    assert.strictEqual(false, returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.Length();');
    assert.strictEqual(6, returnVal?.value);

    returnVal = executeReturnCode('a = "   abcdef    "; return a.Trim().Length();');
    assert.strictEqual(6, returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.SubString(0,1);');
    assert.strictEqual('a', returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.SubString(-3);');
    assert.strictEqual('def', returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.SubString(2);');
    assert.strictEqual('cdef', returnVal?.value);

    returnVal = executeReturnCode('a = "abcdef"; return a.Concat(2,3,4, true, false);');
    assert.strictEqual('abcdef234truefalse', returnVal?.value);

});

test('022', (t) => {
    let returnVal;

    returnVal = executeReturnCode('a = \'\r\n\'; return a;');
    assert.strictEqual('\r\n', returnVal?.value);

    returnVal = executeReturnCode('a = "\r\n"; return a;');
    assert.strictEqual("\r\n", returnVal?.value);

    returnVal = executeReturnCode('a = "a"; return a+(1).toString();');
    assert.strictEqual('a1', returnVal?.value);

});

test('023', (t) => {
    let context, returnVal;

    context = createCodeContext('return a.Count()');
    context.setVariable('a', new StackVariableArray(true, ['a', 'b', 'c']));
    returnVal = context.exec(true);
    assert.strictEqual(3, returnVal?.value);

    context = createCodeContext('return a.Contains("b")');
    context.setVariable('a', new StackVariableArray(true, ['a', 'b', 'c']));
    returnVal = context.exec(true);
    assert.strictEqual(true, returnVal?.value);

    context = createCodeContext('return a.Contains("z")');
    context.setVariable('a', new StackVariableArray(true, ['a', 'b', 'c']));
    returnVal = context.exec(true);
    assert.strictEqual(false, returnVal?.value);

});


test('024', (t) => {
    let context = createCodeContext('return DateTime.Now.AddDays(1).ToString();');
    let returnVal = context.exec(true);
    const m = (returnVal as StackVariableString).value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
    assert.strictEqual(true, !!m);

    context = createCodeContext('return DateTime.Now.AddDays(1).AddHours(1).AddMinutes(1).AddSeconds(1).ToString()');
    returnVal = context.exec(true);
});


test('025', (t) => {
    let returnVal;

    returnVal = executeReturnCode('return Math.abs(-1)');
    assert.strictEqual(1, returnVal?.value);

    returnVal = executeReturnCode('return Math.acos(-1)');
    assert.strictEqual(3.141592653589793, returnVal?.value);

    returnVal = executeReturnCode('return Math.acos(2).isNaN;');
    assert.strictEqual(isNaN(Math.acos(2)), returnVal?.value);

    returnVal = executeReturnCode('return Math.acosh(2)');
    assert.strictEqual(1.3169578969248166, returnVal?.value);

    returnVal = executeReturnCode('return Math.asin(0.5)');
    assert.strictEqual(0.5235987755982989, returnVal?.value);

    returnVal = executeReturnCode('return Math.asin(2).isNaN;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('return Math.asinh(1)');
    assert.strictEqual(0.881373587019543, returnVal?.value);

    returnVal = executeReturnCode('return Math.atan(1)');
    assert.strictEqual(0.7853981633974483, returnVal?.value);

    returnVal = executeReturnCode('return Math.atan2(90, 15)');
    assert.strictEqual(1.4056476493802699, returnVal?.value);

    returnVal = executeReturnCode('return Math.atanh(0.5)');
    assert.strictEqual(0.5493061443340548, returnVal?.value);

    returnVal = executeReturnCode('return Math.ceil(-7.004)');
    assert.strictEqual(-7, returnVal?.value);

    returnVal = executeReturnCode('return Math.ceil(0.95)');
    assert.strictEqual(1, returnVal?.value);

    returnVal = executeReturnCode('return Math.ceil(7.004)');
    assert.strictEqual(8, returnVal?.value);

    returnVal = executeReturnCode('return Math.cos(1)');
    assert.strictEqual(0.5403023058681398, returnVal?.value);

    returnVal = executeReturnCode('return Math.cosh(1)');
    assert.strictEqual(1.5430806348152437, returnVal?.value);

    returnVal = executeReturnCode('return Math.exp(1)');
    assert.strictEqual(2.718281828459045, returnVal?.value);

    returnVal = executeReturnCode('return Math.expm1(1)');
    assert.strictEqual(1.718281828459045, returnVal?.value);

    returnVal = executeReturnCode('return Math.floor(-45.95)');
    assert.strictEqual(-46, returnVal?.value);

    returnVal = executeReturnCode('return Math.floor(45.05)');
    assert.strictEqual(45, returnVal?.value);

    returnVal = executeReturnCode('return Math.hypot(3, 4)');
    assert.strictEqual(5, returnVal?.value);

    returnVal = executeReturnCode('return Math.log(10)');
    assert.strictEqual(2.302585092994046, returnVal?.value);

    returnVal = executeReturnCode('return Math.log10(2)');
    assert.strictEqual(0.3010299956639812, returnVal?.value);

    returnVal = executeReturnCode('return Math.log1p(1)');
    assert.strictEqual(0.6931471805599453, returnVal?.value);

    returnVal = executeReturnCode('return Math.max(4,3,6,9,1,0)');
    assert.strictEqual(9, returnVal?.value);

    returnVal = executeReturnCode('return Math.min(4,3,6,9,1,0)');
    assert.strictEqual(0, returnVal?.value);

    returnVal = executeReturnCode('return Math.pow(7,3)');
    assert.strictEqual(343, returnVal?.value);

    returnVal = executeReturnCode('return Math.round(5.05)');
    assert.strictEqual(5, returnVal?.value);

    returnVal = executeReturnCode('return Math.round(5.5)');
    assert.strictEqual(6, returnVal?.value);

    returnVal = executeReturnCode('return Math.sin(1)');
    assert.strictEqual(0.8414709848078965, returnVal?.value);

    returnVal = executeReturnCode('return Math.sin(Math.PI / 2)');
    assert.strictEqual(1, returnVal?.value);

    returnVal = executeReturnCode('return Math.sinh(1)');
    assert.strictEqual(1.1752011936438014, returnVal?.value);

    returnVal = executeReturnCode('return Math.sqrt(2)');
    assert.strictEqual(1.4142135623730951, returnVal?.value);

    returnVal = executeReturnCode('return Math.tan(Math.PI / 4)');
    assert.strictEqual(0.9999999999999999, returnVal?.value);

    returnVal = executeReturnCode('return Math.tan(1)');
    assert.strictEqual(1.5574077246549023, returnVal?.value);

    returnVal = executeReturnCode('return Math.tanh(1)');
    assert.strictEqual(0.7615941559557649, returnVal?.value);

    returnVal = executeReturnCode(`
    a = 2;
    for (i=0;i<5;i++)
    {
        a = Math.pow(a, 2);
    }
    
    return a;
    `);

    assert.strictEqual(4294967296, returnVal?.value);
});

test('025_2', (t) => {


    const returnVal = executeReturnCode(`
    timeStr = DateTime.Now.ToString();
    ar = [DateTime.Now.ToString(),1,2,3];
    retVal = '';
    i = 0;
    
    for (i=0;i<ar.Count();i++)
    {
        retVal = retVal+ar[i].toString();
    }
    
    return [timeStr, retVal, ar.Count(), i];
    `);

    assert.strictEqual(true, returnVal instanceof StackVariableArray);

    if (returnVal instanceof StackVariableArray) {
        assert.strictEqual(4, returnVal.value.size);
        assert.strictEqual(true, returnVal.value.get('0') instanceof StackVariableString);
        assert.strictEqual(true, returnVal.value.get('1') instanceof StackVariableString);
        assert.strictEqual(true, returnVal.value.get('2') instanceof StackVariableNumber);
        assert.strictEqual(true, returnVal.value.get('3') instanceof StackVariableNumber);

        const ar = returnVal.convertToNativeArray();

        assert.strictEqual(ar[0] + '123', ar[1]);
        assert.strictEqual(4, ar[2]);
        assert.strictEqual(4, ar[3]);
    }
});

test('026', (t) => {


    const returnVal = executeReturnCode(`
    a = [1,2,3];
    
        a[1] = DateTime.Now.ToString();

    
    return a;
    
    `);

    if (returnVal instanceof StackVariableArray) {
        assert.strictEqual(true, returnVal.value.get('0') instanceof StackVariableNumber)
        assert.strictEqual(true, returnVal.value.get('1') instanceof StackVariableString)
        assert.strictEqual(true, returnVal.value.get('2') instanceof StackVariableNumber)
        assert.strictEqual(3, returnVal.value.size);

        //let ar = returnVal.convertToNativeArray();
    }
});

test('027', (t) => {



    const returnVal = executeReturnCode(`
    a = [1,2,3];
    b = a;
    
    a = [b,b,b];
    
    a[0][0] = 9;
    
    return a;
    
    `);

    if (returnVal instanceof StackVariableArray) {
        const ar:unknown[][] = returnVal.convertToNativeArray() as typeof ar;

        assert.strictEqual(9, ar[0][0]);
        assert.strictEqual(1, ar[1][0]);
        assert.strictEqual(1, ar[2][0]);
    }

});

test('028', (t) => {
    let returnVal, ar;

    returnVal = executeReturnCode(`
        return 'a';
        return 'b';
    `);

    assert.strictEqual('a', returnVal?.value);

    returnVal = executeReturnCode(`
        i = 0;
    
        for (;;;) {
            i++;
            if (i>10)
                break;
        }
        
        return 'ok'+i.toString();
    `);

    assert.strictEqual('ok11', returnVal?.value);

    // Строка в арифметике — ошибка TypeMismatch, а не приведение к числу.
    for (const script of ["return '10'-5;", "return 5*'5';", "return 5/'5';", "a = '1'; b = a++; return b;", "a = '1'; b = a--; return b;"]) {
        assert.strictEqual('TypeMismatch', errorOf(script)?.getErrorCode(), script);
    }

    returnVal = executeReturnCode(`
        a = -5;
        return +a;
    `);

    assert.strictEqual(-5, returnVal?.value);

    returnVal = executeReturnCode(`
        a = 1;
        b = a++;
        c = ++a;
        return [a,b,c];
    `);

    ar = (returnVal as StackVariableArray).convertToNativeArray();

    assert.strictEqual(3, ar[0]);
    assert.strictEqual(1, ar[1]);
    assert.strictEqual(3, ar[2]);

    returnVal = executeReturnCode(`
        a = 1;
        b = a--;
        c = --a;
        return [a,b,c];
    `);

    ar = (returnVal as StackVariableArray).convertToNativeArray();

    assert.strictEqual(-1, ar[0]);
    assert.strictEqual(1, ar[1]);
    assert.strictEqual(-1, ar[2]);

    returnVal = executeReturnCode(`
        a = '1';
        return a.length++;
    `);

    assert.strictEqual(1, returnVal?.value);
});

test('029', (t) => {
    let returnVal;

    returnVal = executeReturnCode(`
        a = [1,2,3,4];
        return [a.pUsH('a','b','c','d'), a, a.pop()];
    `);

    const ar2:unknown[][] = (returnVal as StackVariableArray).convertToNativeArray() as typeof ar2;

    assert.strictEqual(8, ar2[0]);
    assert.strictEqual('d', ar2[1][7]);

    returnVal = executeReturnCode(`
        a = [1,2,150,3,4];
        return Math.max(5,...a,50);
    `);

    assert.strictEqual(150, returnVal?.value);

    returnVal = executeReturnCode(`
        return [1,2,150,3,4].join();
    `);

    assert.strictEqual('1,2,150,3,4', returnVal?.value);

    returnVal = executeReturnCode(`
        return [1,2,150,3,4].join('-');
    `);

    assert.strictEqual('1-2-150-3-4', returnVal?.value);

    returnVal = executeReturnCode(`
        return [1,2,3].concat('a','b','c').concat([4,5,6]).join();
    `);

    assert.strictEqual('1,2,3,a,b,c,4,5,6', returnVal?.value);

    returnVal = executeReturnCode(`
        ar = [];
        ar['a'] = 'd';
        ar['b'] = 'e';
        ar['c'] = 'b';
        ar['d'] = 'u';
        ar['e'] = 'g';

        s = '';

        for (i=0;i<ar.count();i++)
        {
            s = s+ ar[ar.keys()[i]];
        }

        return s;
    `);
});

test('029_2', (t) => {
    const returnVal = executeReturnCode(`
    k1 = 'ab';
    k2 = 'cd';

    ar = [k1+k2=>k1,0=>'a',1=>5];

    return ar.join()+'_'+ar.keys().join();
    `);

    assert.strictEqual('ab,a,5_abcd,0,1', returnVal?.value);
});

test('029_3', (t) => {
    let returnVal, ar;

    returnVal = executeReturnCode(`
    k1 = 'ab';
    k2 = 'cd';

    ar = [k1+k2=>k1,0=>'a',1=>5];

    return [ar.flip().keys().join(), ar.flip().values().join()];
    `);

    ar = (returnVal as StackVariableArray).convertToNativeArray();

    assert.strictEqual('ab,a,5', ar[0]);
    assert.strictEqual('abcd,0,1', ar[1]);

    returnVal = executeReturnCode(`

    ar = [1,2,3];

    ar.shift();

    for (i=0;i<50;i++) ar.unshift(Math.random());

    ar.push('a');
    ar.push('b');
    ar.push('c');

    for (i=0;i<50;i++) ar.push(Math.random());

    return ar;

    `);

    ar = (returnVal as StackVariableArray).convertToNativeMap();

    assert.strictEqual(2, ar.get('50'));
    assert.strictEqual(3, ar.get('51'));
    assert.strictEqual('a', ar.get('52'));
    assert.strictEqual('b', ar.get('53'));
    assert.strictEqual('c', ar.get('54'));
});

test('030', () => {
    // Содержимое выровнено с PHP testMSLang030 (раньше под одним именем жили разные проверки).
    // Число и строка не складываются и не вычитаются — TypeMismatch.
    assert.strictEqual('TypeMismatch', errorOf("return 2+'2';")?.getErrorCode());
    assert.strictEqual('TypeMismatch', errorOf("return 2-'1';")?.getErrorCode());

    // Явное приведение в обе стороны.
    assert.strictEqual('22', executeReturnCode("return (2).toString()+'2';")?.value);
    assert.strictEqual(1, executeReturnCode("return 2-Number.parseInt('1');")?.value);
});

// --- Перенесено из PHP-зеркала (tests/Test.php) ---

test('031_IfElse', (t) => {
    let returnVal;

    // 1. if (true)
    returnVal = executeReturnCode('a = 10; if (a == 10) { a = 20; } return a;');
    assert.strictEqual(20, returnVal?.value);

    // 2. if (false)
    returnVal = executeReturnCode('a = 10; if (a == 11) { a = 20; } return a;');
    assert.strictEqual(10, returnVal?.value);

    // 3. if (true) ... else ...
    returnVal = executeReturnCode('a = 10; if (a == 10) { a = 20; } else { a = 30; } return a;');
    assert.strictEqual(20, returnVal?.value);

    // 4. if (false) ... else ...
    returnVal = executeReturnCode('a = 10; if (a == 11) { a = 20; } else { a = 30; } return a;');
    assert.strictEqual(30, returnVal?.value);
});

test('032_LogicalOperators', (t) => {
    let returnVal;

    // 1. AND (true && true)
    returnVal = executeReturnCode('return (1 == 1) && (2 == 2);');
    assert.strictEqual(true, returnVal?.value);

    // 2. AND (true && false)
    returnVal = executeReturnCode('return (1 == 1) && (2 == 3);');
    assert.strictEqual(false, returnVal?.value);

    // 3. OR (true || false)
    returnVal = executeReturnCode('return (1 == 1) || (2 == 3);');
    assert.strictEqual(true, returnVal?.value);

    // 4. OR (false || false)
    returnVal = executeReturnCode('return (1 == 2) || (2 == 3);');
    assert.strictEqual(false, returnVal?.value);

    // 5. Приоритет: && раньше ||. (false || (true && false)) -> false
    returnVal = executeReturnCode('return false || true && false;');
    assert.strictEqual(false, returnVal?.value);

    // 6. Приоритет со скобками: (true) && false -> false
    returnVal = executeReturnCode('return (false || true) && false;');
    assert.strictEqual(false, returnVal?.value);
});

test('033_WhileLoop', (t) => {
    const returnVal = executeReturnCode(`
        a = 0;
        i = 0;
        while (i < 5) {
            a = a + 10;
            i = i + 1;
        }
        return a;
    `);
    assert.strictEqual(50, returnVal?.value);
});

test('034_MissingOperatorsAndKeywords', (t) => {
    let returnVal;

    // 1. Оператор % (modulo)
    returnVal = executeReturnCode('return 10 % 3;');
    assert.strictEqual(1, returnVal?.value);

    // 2. Оператор & (битовое И)
    returnVal = executeReturnCode('return 7 & 3;');
    assert.strictEqual(3, returnVal?.value);

    // 3. Ключевое слово null
    returnVal = executeReturnCode('return null;');
    assert.strictEqual(VariableType.vtNull, returnVal?.type);
    assert.strictEqual(null, returnVal?.value);

    // 4. Сравнение с null
    returnVal = executeReturnCode('a = null; return a == null;');
    assert.strictEqual(true, returnVal?.value);

    // 5. undefined при доступе к несуществующему свойству
    returnVal = executeReturnCode('a = []; return a.foo == null;');
    assert.strictEqual(true, returnVal?.value);
});

test('035_SpecialNumbersAndAssignments', (t) => {
    let returnVal;

    // 1. Каскадное присваивание
    returnVal = executeReturnCode('a = 0; b = 0; a = b = 10; return a + b;');
    assert.strictEqual(20, returnVal?.value);

    // 2. NaN.isNaN
    returnVal = executeReturnCode('return NaN.isNaN;');
    assert.strictEqual(true, returnVal?.value);

    // 3. Infinity и isFinite
    returnVal = executeReturnCode('a = Infinity; return [a.isFinite, (1/0).isFinite];');
    const ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(false, ar[0]);
    assert.strictEqual(false, ar[1]);
});

test('036_DateTimeFeatures', (t) => {
    // 1. DateTime.Today — полночь сегодня. С появлением конфига DateTime стал
    // детерминированным в зоне конфига (по умолчанию UTC), поэтому реконструируем
    // дату в UTC (раньше тест неявно зависел от локальной зоны сервера).
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);

    let returnVal = executeReturnCode('return DateTime.Today;');
    const actualDate = new Date((returnVal?.value as number) * 1000);
    assert.strictEqual(todayMidnight.toISOString().slice(0, 10), actualDate.toISOString().slice(0, 10));
    assert.strictEqual(0, actualDate.getUTCHours());
    assert.strictEqual(0, actualDate.getUTCMinutes());
    assert.strictEqual(0, actualDate.getUTCSeconds());

    // 2. Свойства .Year, .Month, .Day
    returnVal = executeReturnCode('a = DateTime.Today; return [a.Year, a.Month, a.Day];');
    const ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(todayMidnight.getUTCFullYear(), ar[0]);
    assert.strictEqual(todayMidnight.getUTCMonth() + 1, ar[1]);
    assert.strictEqual(todayMidnight.getUTCDate(), ar[2]);

    // 3. Сравнение DateTime.Now > DateTime.Today
    returnVal = executeReturnCode('return DateTime.Now > DateTime.Today;');
    assert.strictEqual(true, returnVal?.value);
});

test('037_StringAndArrayFeatures', (t) => {
    let returnVal;

    // 1. string.length
    returnVal = executeReturnCode('a = "hello"; return a.length;');
    assert.strictEqual(5, returnVal?.value);

    // 2. string.indexOf — найдено
    returnVal = executeReturnCode('a = "hello world"; return a.indexOf("world");');
    assert.strictEqual(6, returnVal?.value);

    // 3. string.indexOf — не найдено
    returnVal = executeReturnCode('a = "hello world"; return a.indexOf("foo");');
    assert.strictEqual(-1, returnVal?.value);

    // 4. array.indexOf
    returnVal = executeReturnCode('a = ["a", "b", "c"]; return a.indexOf("b");');
    assert.strictEqual(1, returnVal?.value);

    // 5. Ключ массива как выражение
    returnVal = executeReturnCode('a = [1,2,3]; a[1+1] = 5; return a.join();');
    assert.strictEqual('1,2,5', returnVal?.value);

    // 6. Ассоциативный массив
    returnVal = executeReturnCode('a = ["key1" => 10, "key2" => 20]; return a["key1"] + a["key2"];');
    assert.strictEqual(30, returnVal?.value);
});

test('038_TypeCastingToString', (t) => {
    let returnVal;

    // 1. Неявного приведения к строке нет: строка + не-строка — TypeMismatch.
    for (const script of ['return "val-" + null;', 'return "val-" + true;', 'return "val-" + [1,2];', 'return "val-" + 5;']) {
        assert.strictEqual('TypeMismatch', errorOf(script)?.getErrorCode(), script);
    }
    // Явное приведение через .ToString() работает.
    assert.strictEqual('val-null', executeReturnCode('return "val-" + null.ToString();')?.value);
    assert.strictEqual('val-true', executeReturnCode('return "val-" + true.ToString();')?.value);
    assert.strictEqual('val-array', executeReturnCode('return "val-" + [1,2].ToString();')?.value);

    // 2. Явное .ToString()
    returnVal = executeReturnCode('return null.ToString();');
    assert.strictEqual('null', returnVal?.value);

    returnVal = executeReturnCode('return [1,2,3].ToString();');
    assert.strictEqual('array', returnVal?.value);
});

test('039_StringCastingToNumber', (t) => {
    let returnVal;

    // Строка в арифметике к числу не приводится — TypeMismatch.
    for (const script of ['return "10.5" * 2;', 'return "" - 5;', 'return "abc" - 5;', 'return Math.abs("abc" * 1);']) {
        assert.strictEqual('TypeMismatch', errorOf(script)?.getErrorCode(), script);
    }

    // Явное приведение — Number.parseFloat.
    returnVal = executeReturnCode('return Number.parseFloat("10.5") * 2;');
    assert.strictEqual(21, returnVal?.value);
    returnVal = executeReturnCode('return Number.parseFloat("abc").isNaN;');
    assert.strictEqual(true, returnVal?.value);
});

test('040_AdvancedDateTime', (t) => {
    let returnVal;

    // 1. Дата сравнивается только с датой; строку сначала разбирают DateTime.parse.
    returnVal = executeReturnCode('return DateTime.Now > DateTime.parse("2000-01-01 12:00:00", "YYYY-MM-DD HH:mm:ss");');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('return DateTime.Now < DateTime.parse("1999-01-01 12:00:00", "YYYY-MM-DD HH:mm:ss");');
    assert.strictEqual(false, returnVal?.value);

    assert.strictEqual('TypeMismatch', errorOf('return DateTime.Now > "2000-01-01 12:00:00";')?.getErrorCode());

    // 2. AddHours и свойства. DateTime детерминирован в зоне конфига (по умолчанию
    // UTC), поэтому сравниваем с UTC-датой (раньше тест зависел от локальной зоны).
    returnVal = executeReturnCode('a = DateTime.Today.AddHours(9); return [a.Day, a.Hour, a.Minute];');
    const ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(new Date().getUTCDate(), ar[0]);
    assert.strictEqual(9, ar[1]);
    assert.strictEqual(0, ar[2]);

    // 3. DayOfWeek (свойство, 0=Sun..6=Sat)
    returnVal = executeReturnCode('return DateTime.Today.DayOfWeek;');
    assert.strictEqual(new Date().getUTCDay(), returnVal?.value);
});

test('041_AdvancedArrayFeatures', (t) => {
    let returnVal;

    // 1. Динамический ключ
    returnVal = executeReturnCode(`
        keyName = "dynamicKey";
        a = [keyName => 100, "staticKey" => 200];
        return a["dynamicKey"] + a["staticKey"];
    `);
    assert.strictEqual(300, returnVal?.value);

    // 2. Метод .values()
    returnVal = executeReturnCode(`
        a = ["c" => 10, "b" => 20, "a" => 30];
        return a.values().join("-");
    `);
    assert.strictEqual('10-20-30', returnVal?.value);
});

test('042_SideEffectsAndComplexExpressions', (t) => {
    let returnVal;

    // 1. break в while
    returnVal = executeReturnCode(`
        i = 0;
        while(true) {
            i++;
            if (i == 15) {
                break;
            }
        }
        return i;
    `);
    assert.strictEqual(15, returnVal?.value);

    // 2. ++a + a (11 + 11)
    returnVal = executeReturnCode('a = 10; return ++a + a;');
    assert.strictEqual(22, returnVal?.value);

    // 3. a++ + a (10 + 11)
    returnVal = executeReturnCode('a = 10; return a++ + a;');
    assert.strictEqual(21, returnVal?.value);

    // 4. --a + a (9 + 9)
    returnVal = executeReturnCode('a = 10; return --a + a;');
    assert.strictEqual(18, returnVal?.value);

    // 5. a-- + a (10 + 9)
    returnVal = executeReturnCode('a = 10; return a-- + a;');
    assert.strictEqual(19, returnVal?.value);
});

test('043_VariableScoping', (t) => {
    // 1. Переменная a обновляется, b (создана в блоке) исчезает
    const returnVal = executeReturnCode(`
        a = 10;
        {
            a = 20;
            b = 30;
        }
        return a;
    `);
    assert.strictEqual(20, returnVal?.value);

    // 2. Доступ к b снаружи → ошибка
    assert.throws(() => {
        executeReturnCode(`
            a = 10;
            {
                b = 30;
            }
            return b;
        `);
    }, /variable not defined b/);
});

test('043_ScopingPart2', (t) => {
    // 3. b объявлена снаружи — обновляется
    const returnVal = executeReturnCode(`
        a = 10;
        b = 10;
        {
            a = 20;
            b = 30;
        }
        return a + b;
    `);
    assert.strictEqual(50, returnVal?.value);
});

test('044_ArrayUnpackOperator', (t) => {
    let returnVal;

    // 1. Простая распаковка
    returnVal = executeReturnCode(`
        a = [2, 3, 4];
        return Math.max(1, ...a, 5);
    `);
    assert.strictEqual(5, returnVal?.value);

    // 2. Распаковка в .concat()
    returnVal = executeReturnCode(`
        a = [1, 2];
        b = [3, 4];
        return a.concat(...b).join();
    `);
    assert.strictEqual('1,2,3,4', returnVal?.value);
});

test('045_CoercionToNumber', () => {
    // null и boolean к числу не приводятся: арифметика с ними — TypeMismatch.
    for (const script of ['return null + 5;', 'return true + 5;', 'return false + 5;', 'return 5 - null;', 'return true * 2;']) {
        assert.strictEqual('TypeMismatch', errorOf(script)?.getErrorCode(), script);
    }
});

test('046_ComplexBooleanLogic', (t) => {
    let returnVal;

    // 1. !(true && false) → true
    returnVal = executeReturnCode('return !(true && false);');
    assert.strictEqual(true, returnVal?.value);

    // 2. !(true || false) → false
    returnVal = executeReturnCode('return !(true || false);');
    assert.strictEqual(false, returnVal?.value);

    // 3. Закон Де Моргана: !(a || b) == !a && !b
    returnVal = executeReturnCode(`
        a = true;
        b = false;
        return !(a || b) == (!a && !b);
    `);
    assert.strictEqual(true, returnVal?.value);
});

test('047_ComplexAssignments', (t) => {
    let returnVal;

    // 1. Присваивание по ключу
    returnVal = executeReturnCode('a = [10, 20]; a[0] = 30; return a[0];');
    assert.strictEqual(30, returnVal?.value);

    // 2. Каскадное присваивание по ключу: a[0] = b = 40
    returnVal = executeReturnCode(`
        a = [10, 20];
        b = 0;
        a[0] = b = 40;
        return a[0] + b;
    `);
    assert.strictEqual(80, returnVal?.value);

    // 3. Каскад по разным ключам: a[0] = a[1] = 5
    returnVal = executeReturnCode(`
        a = [1, 2, 3];
        a[0] = a[1] = 5;
        return a.join();
    `);
    assert.strictEqual('5,5,3', returnVal?.value);
});

test('048_EvaluationOrder', (t) => {
    // a[i++] = i; i=0 → ключ 0, i=1, значение 1 → a[0]=1, a[1]=0, i=1
    const returnVal = executeReturnCode(`
        i = 0;
        a = [0, 0, 0];
        a[i++] = i;
        return [a[0], a[1], i];
    `);
    const ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(1, ar[0]);
    assert.strictEqual(0, ar[1]);
    assert.strictEqual(1, ar[2]);
});

test('049_PropertyIncrement', (t) => {
    // Один объект хоста, два контекста: первый делает ++, второй читает.
    const fieldsObj = new TestObject();

    const contextAction = createCodeContext('Fields.Number1++;');
    contextAction.setVariable('Fields', fieldsObj);
    contextAction.exec(true);

    const contextCheck = createCodeContext('return Fields.Number1;');
    contextCheck.setVariable('Fields', fieldsObj);
    const returnVal = contextCheck.exec(true);

    assert.strictEqual(11, returnVal?.value);
});

test('050_InvalidArrayKeys', (t) => {
    assert.throws(() => {
        executeReturnCode('return [null => 1];');
    }, /array key must be number or string/);
});

test('050_InvalidArrayKeysPart2', (t) => {
    assert.throws(() => {
        executeReturnCode('return [true => 1];');
    }, /array key must be number or string/);
});

test('050_InvalidArrayKeysPart3', (t) => {
    assert.throws(() => {
        executeReturnCode('return [[1,2] => 1];');
    }, /array key must be number or string/);
});

test('051_DoubleNegativeCasting', () => {
    // Двойное отрицание определено только для boolean: !!true — true, !!false — false.
    assert.strictEqual(true, executeReturnCode('return !!true;')?.value);
    assert.strictEqual(false, executeReturnCode('return !!false;')?.value);
    assert.strictEqual(true, executeReturnCode('return !!(10 > 0);')?.value);

    // Число, строка, массив, null — не условие: ошибка NotBoolean, а не приведение.
    for (const expr of ['10', '0', '"hello"', '""', '[1,2]', '[]', 'null']) {
        assert.strictEqual('NotBoolean', errorOf(`return !!${expr};`)?.getErrorCode(), `!!${expr}`);
    }
});

test('052_DateTimeAdvancedComparison', (t) => {
    let returnVal;

    returnVal = executeReturnCode('return DateTime.Now == null;');
    assert.strictEqual(false, returnVal?.value);

    returnVal = executeReturnCode('return DateTime.Now != null;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('return DateTime.Now == true;');
    assert.strictEqual(false, returnVal?.value);
});

test('053_StringIndexOfWithPosition', (t) => {
    let returnVal;

    returnVal = executeReturnCode('return "hello hello".indexOf("hello");');
    assert.strictEqual(0, returnVal?.value);

    returnVal = executeReturnCode('return "hello hello".indexOf("hello", 1);');
    assert.strictEqual(6, returnVal?.value);

    returnVal = executeReturnCode('return "hello hello".indexOf("world", 1);');
    assert.strictEqual(-1, returnVal?.value);
});

test('054_ParserSyntaxErrors', (t) => {
    assert.throws(() => {
        executeReturnCode('a = 1 +;');
    }, /Parse expression failed/);
});

test('054_ParserSyntaxErrors_Part2', (t) => {
    assert.throws(() => {
        executeReturnCode('a = [1,2,3] 5;');
    }, /Parse expression failed/);
});

test('055_ExecutionLimit', (t) => {
    const context = createCodeContext('for(i=0; i<10000000000; i=i+1) {}');
    context.setLimitExecInstruction(10000000);
    assert.throws(() => {
        context.exec(true);
    }, /Execution limit/);
});

test('056_ArrayCoercion', () => {
    // Массив в арифметике к строке не приводится: [1,2] + 1 — TypeMismatch.
    // Склеить можно явно: через join() и toString().
    for (const script of ['return [1,2] + 1;', 'return 1 + [1,2];', 'return [1,2] + [3,4];']) {
        assert.strictEqual('TypeMismatch', errorOf(script)?.getErrorCode(), script);
    }
    assert.strictEqual('1,21', executeReturnCode('return [1,2].join() + (1).toString();')?.value);
    assert.strictEqual('1,23,4', executeReturnCode('return [1,2].join() + [3,4].join();')?.value);
});

test('057_UnaryCoercion', () => {
    // Унарные + и - определены только для чисел: строка, boolean, null, массив — TypeMismatch.
    for (const script of ['return +"10.5";', 'return -true;', 'return +null;', 'return +"";', 'return +"hello";', 'return +[];']) {
        assert.strictEqual('TypeMismatch', errorOf(script)?.getErrorCode(), script);
    }
    assert.strictEqual(10.5, executeReturnCode('return +10.5;')?.value);
    assert.strictEqual(-3, executeReturnCode('let n = 3; return -n;')?.value);
    assert.strictEqual(3, executeReturnCode('return -(2 - 5);')?.value);
});

test('058_AbsentIsNull', (t) => {
    let returnVal;

    returnVal = executeReturnCode('a = []; return a.foo == null;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('a = []; return a.foo == null;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('a = []; return null == a.foo;');
    assert.strictEqual(true, returnVal?.value);

    // Арифметика с отсутствующим значением — TypeMismatch.
    assert.strictEqual('TypeMismatch', errorOf('a = []; return null + a.foo;')?.getErrorCode());
});

test('059_ArraySpreadLiteral', (t) => {
    const returnVal = executeReturnCode(`
        a = [2, 3];
        b = [1, ...a, 4];
        return b.join();
    `);
    assert.strictEqual('1,2,3,4', returnVal?.value);
});

test('060_ArrayLengthManipulation', (t) => {
    let returnVal;

    // 1. Усечение через .length
    returnVal = executeReturnCode('a = [1,2,3,4,5]; a.length = 2; return a.join();');
    assert.strictEqual('1,2', returnVal?.value);

    // 2. Расширение через .length
    returnVal = executeReturnCode('a = [1,2]; a.length = 4; return [a.length, a[3] == null, a.join()];');
    const ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(4, ar[0]);
    assert.strictEqual(true, ar[1]);
    assert.strictEqual('1,2,,', ar[2]);
});

test('061_NestedLoopControl', (t) => {
    let returnVal;

    // 1. break во вложенном цикле — выходит только из внутреннего
    returnVal = executeReturnCode(`
        a = 0;
        for(i=0; i<3; i++) {
            for(j=0; j<3; j++) {
                if (i == 1 && j == 1) {
                    break;
                }
                a = a + 1;
            }
        }
        return a;
    `);
    assert.strictEqual(7, returnVal?.value);

    // 2. continue во вложенном цикле — пропускает итерацию внутреннего
    returnVal = executeReturnCode(`
        a = 0;
        for(i=0; i<3; i++) {
            for(j=0; j<3; j++) {
                if (i == 1 && j == 1) {
                    continue;
                }
                a = a + 1;
            }
        }
        return a;
    `);
    assert.strictEqual(8, returnVal?.value);
});

test('062_EvaluationOrderReversed', (t) => {
    // a[i] = i++; i=0 → ключ 0, значение 0 (потом i=1), a[0]=0
    const returnVal = executeReturnCode(`
        i = 0;
        a = [0, 0, 0];
        a[i] = i++;
        return [a[0], a[1], i];
    `);
    const ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(0, ar[0]);
    assert.strictEqual(0, ar[1]);
    assert.strictEqual(1, ar[2]);
});

test('063_InvalidControlFlow', (t) => {
    assert.throws(() => {
        executeReturnCode('break;');
    }, /break invalid statement/);
});

test('063_InvalidControlFlow_Part2', (t) => {
    assert.throws(() => {
        executeReturnCode('continue;');
    }, /continue invalid statement/);
});

test('064_CyclicReference', (t) => {
    const returnVal = executeReturnCode(`
        a = [1,2];
        a[0] = a;
        return [a[0] == a, a[0][0] == a];
    `);
    const ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(true, ar[0]);
    assert.strictEqual(true, ar[1]);
});

test('065_BitwiseCoercion', () => {
    // Битовые операции — только над числами; дробная часть отбрасывается, как в JS.
    for (const script of ['return "7" & 3;', 'return true & 3;', 'return null & 3;', 'return "abc" & 3;', 'return 1 | "1";']) {
        assert.strictEqual('TypeMismatch', errorOf(script)?.getErrorCode(), script);
    }
    assert.strictEqual(3, executeReturnCode('return 7.7 & 3.3;')?.value);
    assert.strictEqual(3, executeReturnCode('return 7 & 3;')?.value);
});

test('066_SparseArrayKeys', (t) => {
    let returnVal, ar;

    // 1. Разреженный массив
    returnVal = executeReturnCode('a = []; a[100] = "test"; return [a.length, a.Count()];');
    ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(1, ar[0]);
    assert.strictEqual(1, ar[1]);

    // 2. .keys() и .values()
    returnVal = executeReturnCode('a = []; a[100] = "test"; return [a.keys().join(), a.values().join()];');
    ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual('100', ar[0]);
    assert.strictEqual('test', ar[1]);
});

test('067_SimpleFor', (t) => {
    const returnVal = executeReturnCode('for(i=0; true; i=i+1) {break;}');
    assert.strictEqual(VariableType.vtVoid, returnVal?.type);
});

test('068_SwitchBasic', (t) => {
    const returnVal = executeReturnCode(`
        x = 2;
        r = "no";
        switch (x) {
            case 1: r = "one"; break;
            case 2: r = "two"; break;
            case 3: r = "three"; break;
        }
        return r;
    `);
    assert.strictEqual('two', returnVal?.value);
});

test('068_SwitchDefault', (t) => {
    const returnVal = executeReturnCode(`
        x = 99;
        r = "none";
        switch (x) {
            case 1: r = "one"; break;
            default: r = "other"; break;
        }
        return r;
    `);
    assert.strictEqual('other', returnVal?.value);
});

test('068_SwitchFallthrough', (t) => {
    const returnVal = executeReturnCode(`
        x = 2;
        r = "";
        switch (x) {
            case 1: r = r + "1";
            case 2: r = r + "2";
            case 3: r = r + "3"; break;
            case 4: r = r + "4";
        }
        return r;
    `);
    assert.strictEqual('23', returnVal?.value);
});

test('068_SwitchNoMatchNoDefault', (t) => {
    const returnVal = executeReturnCode(`
        x = 99;
        r = "untouched";
        switch (x) {
            case 1: r = "one"; break;
            case 2: r = "two"; break;
        }
        return r;
    `);
    assert.strictEqual('untouched', returnVal?.value);
});

test('068_SwitchStringValue', (t) => {
    const returnVal = executeReturnCode(`
        x = "b";
        r = 0;
        switch (x) {
            case "a": r = 1; break;
            case "b": r = 2; break;
            case "c": r = 3; break;
        }
        return r;
    `);
    assert.strictEqual(2, returnVal?.value);
});

test('068_SwitchEmptyCaseFallsThrough', (t) => {
    //case 1 без тела проваливается в case 2.
    const returnVal = executeReturnCode(`
        x = 1;
        r = 0;
        switch (x) {
            case 1:
            case 2: r = 12; break;
            case 3: r = 3; break;
        }
        return r;
    `);
    assert.strictEqual(12, returnVal?.value);
});

test('068_SwitchDefaultMiddleNoFallback', (t) => {
    //default посреди case'ов: если ни один case не сработал, прыгаем на default
    //и идём вниз с fall-through.
    const returnVal = executeReturnCode(`
        x = 99;
        r = "";
        switch (x) {
            case 1: r = r + "1"; break;
            default: r = r + "D";
            case 2: r = r + "2"; break;
        }
        return r;
    `);
    assert.strictEqual('D2', returnVal?.value);
});

test('069_UserFuncBasic', (t) => {
    const returnVal = executeReturnCode(`
        function sum(a, b) {
            return a + b;
        }
        return sum(2, 3);
    `);
    assert.strictEqual(5, returnVal?.value);
});

test('069_UserFuncNoReturnGivesNull', (t) => {
    const returnVal = executeReturnCode(`
        function nothing(a) {
            a = a + 1;
        }
        return nothing(10);
    `);
    assert.strictEqual(VariableType.vtNull, returnVal?.type);
});

test('069_UserFuncBareReturn', (t) => {
    //\`return;\` без значения — null.
    const returnVal = executeReturnCode(`
        function f() {
            return;
        }
        return f();
    `);
    assert.strictEqual(VariableType.vtNull, returnVal?.type);
});

test('069_UserFuncDirectRecursion', (t) => {
    //Имя функции видно внутри её тела (пункт 2 договорённостей).
    const returnVal = executeReturnCode(`
        function fact(n) {
            if (n == 0) { return 1; }
            return n * fact(n - 1);
        }
        return fact(5);
    `);
    assert.strictEqual(120, returnVal?.value);
});

test('069_UserFuncDefaultValue', (t) => {
    const returnVal = executeReturnCode(`
        function greet(name, suffix = "!") {
            return name + suffix;
        }
        return greet("Hi");
    `);
    assert.strictEqual('Hi!', returnVal?.value);
});

test('069_UserFuncDefaultValueOverride', (t) => {
    const returnVal = executeReturnCode(`
        function greet(name, suffix = "!") {
            return name + suffix;
        }
        return greet("Hi", "?");
    `);
    assert.strictEqual('Hi?', returnVal?.value);
});

test('069_UserFuncMissingRequiredThrows', (t) => {
    assert.throws(() => {
        executeReturnCode(`
            function f(a, b) {
                return a + b;
            }
            return f(1);
        `);
    });
});

test('069_UserFuncExtraArgsWarning', (t) => {
    const lexer = new CodeLexer(`
        function f(a) {
            return a;
        }
        return f(1, 2, 3);
    `);
    const parser = new CodeParser(lexer);
    const nodeList: ParseNode[] = [];
    parser.parseCode(nodeList, true, true, LexerTypeArray.one(LexerType.ltEof));

    const interpreter = new Interpreter();
    interpreter.registerHandlers();

    const ctx = new ContextInterpreter(nodeList, interpreter);
    ctx.registerConst();
    const returnVal = ctx.exec(true);

    assert.strictEqual(1, returnVal?.value);
    const warnings = ctx.getWarnings();
    assert.strictEqual(1, warnings.length);
    assert.ok(warnings[0].indexOf('expected at most 1') !== -1);
});

test('069_UserFuncPrimitiveByCopy', (t) => {
    //Параметр-число — копия. Изменение внутри функции не влияет на внешнее.
    const returnVal = executeReturnCode(`
        function bump(x) {
            x = x + 100;
            return x;
        }
        outer = 5;
        inner = bump(outer);
        return [outer, inner];
    `) as StackVariableArray;

    const items = returnVal.value;
    assert.strictEqual(5, items.get('0')?.value);
    assert.strictEqual(105, items.get('1')?.value);
});

test('069_UserFuncArrayByReference', (t) => {
    //Параметр-массив — по ссылке: мутация изнутри видна снаружи.
    const returnVal = executeReturnCode(`
        function pushFive(arr) {
            arr.push(5);
        }
        outer = [1, 2, 3];
        pushFive(outer);
        return outer;
    `) as StackVariableArray;

    assert.strictEqual(4, returnVal.value.size);
    assert.strictEqual(5, returnVal.value.get('3')?.value);
});

test('069_UserFuncParamReassignDoesNotLeak', (t) => {
    //\`arr = newArray()\` внутри функции — переназначение локального параметра.
    //Внешний массив не трогается.
    const returnVal = executeReturnCode(`
        function rebind(arr) {
            arr = [99];
        }
        outer = [1, 2, 3];
        rebind(outer);
        return outer;
    `) as StackVariableArray;

    assert.strictEqual(3, returnVal.value.size);
    assert.strictEqual(1, returnVal.value.get('0')?.value);
});

test('070_HoistCallBeforeDefinition', (t) => {
    //Hoisting: функция доступна выше своей строки-определения.
    const returnVal = executeReturnCode(`
        x = sum(2, 3);
        function sum(a, b) {
            return a + b;
        }
        return x;
    `);
    assert.strictEqual(5, returnVal?.value);
});

test('070_HoistMutualRecursion', (t) => {
    //Взаимная рекурсия: isEven зовёт isOdd ниже определения isEven и наоборот.
    const returnVal = executeReturnCode(`
        function isEven(n) {
            if (n == 0) { return true; }
            return isOdd(n - 1);
        }
        function isOdd(n) {
            if (n == 0) { return false; }
            return isEven(n - 1);
        }
        return [isEven(4), isEven(5), isOdd(3), isOdd(0)];
    `) as StackVariableArray;

    assert.strictEqual(true, returnVal.value.get('0')?.value);
    assert.strictEqual(false, returnVal.value.get('1')?.value);
    assert.strictEqual(true, returnVal.value.get('2')?.value);
    assert.strictEqual(false, returnVal.value.get('3')?.value);
});

test('070_HoistNestedFunction', (t) => {
    //Внутри функции tools используется helper, объявленный ниже.
    const returnVal = executeReturnCode(`
        function tools() {
            return helper() + 1;
            function helper() {
                return 10;
            }
        }
        return tools();
    `);
    assert.strictEqual(11, returnVal?.value);
});

test('070_HoistInSubBlockLimitedToBlock', (t) => {
    //Функция объявлена внутри блока if — она видна только внутри блока.
    const returnVal = executeReturnCode(`
        x = 0;
        if (true) {
            x = bonus(5);
            function bonus(n) { return n + 100; }
        }
        return x;
    `);
    assert.strictEqual(105, returnVal?.value);
});

test('071_ClosureCounterPattern', (t) => {
    //Counter-pattern: внутри функции изменение внешней переменной видно снаружи.
    const returnVal = executeReturnCode(`
        counter = 0;
        function inc() {
            counter = counter + 1;
        }
        inc();
        inc();
        inc();
        return counter;
    `);
    assert.strictEqual(3, returnVal?.value);
});

test('071_ClosureReadOuter', (t) => {
    //Чтение внешней переменной из функции.
    const returnVal = executeReturnCode(`
        base = 10;
        function addBase(x) {
            return x + base;
        }
        return addBase(5);
    `);
    assert.strictEqual(15, returnVal?.value);
});

test('071_NewVariableInsideFunctionGoesGlobal', (t) => {
    //По правилу №1: \`x = 5\` внутри функции, где x нигде не объявлен,
    //создаётся в глобальной области.
    const returnVal = executeReturnCode(`
        function leak() {
            escapedVar = 42;
        }
        leak();
        return escapedVar;
    `);
    assert.strictEqual(42, returnVal?.value);
});

test('071_ParameterShadowsOuter', (t) => {
    //Параметр с тем же именем что и внешняя переменная — не затрагивает внешнюю.
    const returnVal = executeReturnCode(`
        x = 100;
        function modify(x) {
            x = x + 1;
            return x;
        }
        inner = modify(5);
        return [x, inner];
    `) as StackVariableArray;

    assert.strictEqual(100, returnVal.value.get('0')?.value);
    assert.strictEqual(6, returnVal.value.get('1')?.value);
});

test('071_RecursiveParameterIsolated', (t) => {
    //Рекурсивный вызов: параметр текущего call'а не должен затирать параметр родительского.
    const returnVal = executeReturnCode(`
        function fact(n) {
            if (n == 0) { return 1; }
            return n * fact(n - 1);
        }
        return fact(6);
    `);
    assert.strictEqual(720, returnVal?.value);
});

test('071_NestedFunctionCanReturnReference', (t) => {
    //Внутренняя функция, сохранённая снаружи: GC удерживает её через captured snapshot.
    const returnVal = executeReturnCode(`
        function makeAdder(amount) {
            function add(x) {
                return x + amount;
            }
            return add;
        }
        adder = makeAdder(7);
        return adder(3);
    `);
    assert.strictEqual(10, returnVal?.value);
});

test('072_TryCatchBasicThrow', (t) => {
    //throw строки — ловим в catch.
    const returnVal = executeReturnCode(`
        r = "before";
        try {
            throw "oops";
            r = "after-throw";
        } catch (e) {
            r = e;
        }
        return r;
    `);
    assert.strictEqual('oops', returnVal?.value);
});

test('072_TryCatchThrowErrorObject', (t) => {
    //throw new Error(msg) — e.message содержит msg, e.name == "Error".
    const returnVal = executeReturnCode(`
        try {
            throw new Error("custom message");
        } catch (e) {
            return [e.message, e.name];
        }
        return null;
    `) as StackVariableArray;

    assert.strictEqual('custom message', returnVal.value.get('0')?.value);
    assert.strictEqual('Error', returnVal.value.get('1')?.value);
});

test('072_TryCatchNoThrow', (t) => {
    //try без throw — catch не срабатывает.
    const returnVal = executeReturnCode(`
        r = "before";
        try {
            r = "in-try";
        } catch (e) {
            r = "in-catch";
        }
        return r;
    `);
    assert.strictEqual('in-try', returnVal?.value);
});

test('072_TryCatchFinallyAlwaysRuns', (t) => {
    //finally выполняется при успехе.
    const returnVal = executeReturnCode(`
        r = "";
        try {
            r = r + "t";
        } catch (e) {
            r = r + "c";
        } finally {
            r = r + "f";
        }
        return r;
    `);
    assert.strictEqual('tf', returnVal?.value);
});

test('072_TryCatchFinallyAfterCatch', (t) => {
    //finally выполняется и после catch.
    const returnVal = executeReturnCode(`
        r = "";
        try {
            r = r + "t";
            throw "x";
        } catch (e) {
            r = r + "c";
        } finally {
            r = r + "f";
        }
        return r;
    `);
    assert.strictEqual('tcf', returnVal?.value);
});

test('072_TryNestedInnerCatchesFirst', (t) => {
    //Вложенные try: внутренний catch ловит первый throw.
    const returnVal = executeReturnCode(`
        r = "";
        try {
            try {
                throw "inner";
            } catch (e) {
                r = e;
            }
        } catch (e) {
            r = "outer";
        }
        return r;
    `);
    assert.strictEqual('inner', returnVal?.value);
});

test('072_TryNestedRethrowReachesOuter', (t) => {
    //Внутренний catch бросает второй throw — внешний ловит его.
    const returnVal = executeReturnCode(`
        try {
            try {
                throw "first";
            } catch (e) {
                throw "second";
            }
        } catch (e) {
            return e;
        }
        return null;
    `);
    assert.strictEqual('second', returnVal?.value);
});

test('072_ThrowThroughFunctionBoundary', (t) => {
    //throw в функции пробивает границу вызова и ловится внешним try.
    const returnVal = executeReturnCode(`
        function bad() {
            throw "from-function";
        }
        try {
            bad();
        } catch (e) {
            return e;
        }
        return null;
    `);
    assert.strictEqual('from-function', returnVal?.value);
});

test('072_SystemErrorIsCaught', (t) => {
    //Системная ошибка интерпретатора (variable not defined) тоже ловится через catch.
    const returnVal = executeReturnCode(`
        try {
            return undefinedVar;
        } catch (e) {
            return e.message;
        }
    `);
    assert.ok(String(returnVal?.value).indexOf('undefinedVar') !== -1);
});

test('072_UncaughtThrowFails', (t) => {
    //throw без try — должно валить выполнение скрипта.
    assert.throws(() => {
        executeReturnCode(`
            throw "boom";
        `);
    }, /Uncaught/);
});

test('072_CatchWithoutParameter', (t) => {
    //catch без (e) — параметр опционален.
    const returnVal = executeReturnCode(`
        r = "before";
        try {
            throw "ignored";
        } catch {
            r = "caught";
        }
        return r;
    `);
    assert.strictEqual('caught', returnVal?.value);
});

test('073_ClassWithFieldFromCtor', (t) => {
    //Простейший класс: конструктор пишет в this.x.
    const returnVal = executeReturnCode(`
        class Point {
            constructor(x) {
                this.x = x;
            }
        }
        p = new Point(7);
        return p.x;
    `);
    assert.strictEqual(7, returnVal?.value);
});

test('073_ClassMultipleFields', (t) => {
    const returnVal = executeReturnCode(`
        class Pair {
            constructor(a, b) {
                this.a = a;
                this.b = b;
            }
        }
        p = new Pair(3, 4);
        return p.a + p.b;
    `);
    assert.strictEqual(7, returnVal?.value);
});

test('073_ClassMethodCall', (t) => {
    //Метод класса, доступ к this.
    const returnVal = executeReturnCode(`
        class Counter {
            constructor(start) {
                this.value = start;
            }
            next() {
                this.value = this.value + 1;
                return this.value;
            }
        }
        c = new Counter(10);
        r = c.next();
        return r;
    `);
    assert.strictEqual(11, returnVal?.value);
});

test('073_ClassMethodAccumulates', (t) => {
    //Несколько вызовов метода — состояние не теряется.
    const returnVal = executeReturnCode(`
        class Counter {
            constructor() {
                this.value = 0;
            }
            inc(by) {
                this.value = this.value + by;
                return this.value;
            }
        }
        c = new Counter();
        c.inc(2);
        c.inc(3);
        return c.inc(4);
    `);
    assert.strictEqual(9, returnVal?.value);
});

test('073_ClassWithoutConstructor', (t) => {
    //Конструктор не обязателен — поля задаются снаружи.
    const returnVal = executeReturnCode(`
        class Bag {
            getX() {
                return this.x;
            }
        }
        b = new Bag();
        b.x = 42;
        return b.getX();
    `);
    assert.strictEqual(42, returnVal?.value);
});

test('073_TwoInstancesAreIndependent', (t) => {
    const returnVal = executeReturnCode(`
        class Counter {
            constructor() { this.value = 0; }
            inc() { this.value = this.value + 1; return this.value; }
        }
        a = new Counter();
        b = new Counter();
        a.inc(); a.inc(); a.inc();
        b.inc();
        return a.value + 100 * b.value;
    `);
    assert.strictEqual(103, returnVal?.value);
});

test('073_MethodCallsAnotherMethod', (t) => {
    const returnVal = executeReturnCode(`
        class C {
            constructor(n) { this.n = n; }
            doubled() { return this.n * 2; }
            doubledPlusOne() { return this.doubled() + 1; }
        }
        return new C(5).doubledPlusOne();
    `);
    assert.strictEqual(11, returnVal?.value);
});

test('073_ClassHoisted', (t) => {
    //Объявление класса можно использовать до его текстового места — как и функции.
    const returnVal = executeReturnCode(`
        x = new Box(3).get();
        class Box {
            constructor(v) { this.v = v; }
            get() { return this.v; }
        }
        return x;
    `);
    assert.strictEqual(3, returnVal?.value);
});

test('073_ThisOutsideClassFails', (t) => {
    assert.throws(() => {
        executeReturnCode(`
            return this.x;
        `);
    }, /'this' is not available/);
});

test('073_NewUnknownClassFails', (t) => {
    assert.throws(() => {
        executeReturnCode(`
            return new Foo();
        `);
    }, /Unknown class "Foo"/);
});

test('074_ExtendsBasic', (t) => {
    //Метод родителя доступен через obj потомка.
    const returnVal = executeReturnCode(`
        class A {
            hello() { return "A"; }
        }
        class B extends A {}
        return new B().hello();
    `);
    assert.strictEqual('A', returnVal?.value);
});

test('074_SuperCtor', (t) => {
    //super(args) вызывает родительский ctor, поля родителя появляются.
    const returnVal = executeReturnCode(`
        class A {
            constructor(x) { this.x = x; }
        }
        class B extends A {
            constructor(x, y) {
                super(x);
                this.y = y;
            }
        }
        b = new B(3, 4);
        return b.x + b.y;
    `);
    assert.strictEqual(7, returnVal?.value);
});

test('074_SuperMethod', (t) => {
    //super.method берёт реализацию родителя, не своего.
    const returnVal = executeReturnCode(`
        class A {
            kind() { return "A"; }
        }
        class B extends A {
            kind() { return "B"; }
            bothKinds() { return super.kind() + "/" + this.kind(); }
        }
        return new B().bothKinds();
    `);
    assert.strictEqual('A/B', returnVal?.value);
});

test('074_AutoSuperCtor', (t) => {
    //extends-класс без своего ctor использует родительский автоматически.
    const returnVal = executeReturnCode(`
        class A {
            constructor(v) { this.v = v; }
        }
        class B extends A {}
        return new B(42).v;
    `);
    assert.strictEqual(42, returnVal?.value);
});

test('074_ChildOverridesMethod', (t) => {
    //У потомка свой метод — obj.method ведёт к потомку.
    const returnVal = executeReturnCode(`
        class A {
            tag() { return "parent"; }
        }
        class B extends A {
            tag() { return "child"; }
        }
        return new B().tag();
    `);
    assert.strictEqual('child', returnVal?.value);
});

test('074_ThreeLevels', (t) => {
    //A → B → C. super из B вызывает A; через цепочку всё работает.
    const returnVal = executeReturnCode(`
        class A {
            constructor() { this.tag = "A"; }
        }
        class B extends A {
            constructor() {
                super();
                this.tag = this.tag + "+B";
            }
        }
        class C extends B {
            constructor() {
                super();
                this.tag = this.tag + "+C";
            }
        }
        return new C().tag;
    `);
    assert.strictEqual('A+B+C', returnVal?.value);
});

test('074_JSThisInSuperMethod', (t) => {
    //Внутри super.method вызов this.foo() должен резолвиться через
    //цепочку класса instance (потомка), а не родителя.
    const returnVal = executeReturnCode(`
        class A {
            name() { return "A"; }
            greet() { return "Hi, " + this.name(); }
        }
        class B extends A {
            name() { return "B"; }
            shout() { return super.greet(); }
        }
        return new B().shout();
    `);
    assert.strictEqual('Hi, B', returnVal?.value);
});

test('074_NoExtendsSuperFails', (t) => {
    //super() в классе без extends — ошибка.
    assert.throws(() => {
        executeReturnCode(`
            class A {
                constructor() { super(); }
            }
            return new A();
        `);
    }, /without extends/);
});

test('074_UnknownParentFails', (t) => {
    //extends X, где X не объявлен — ошибка при первом обращении к super.
    assert.throws(() => {
        executeReturnCode(`
            class B extends Ghost {
                constructor() { super(); }
            }
            return new B();
        `);
    }, /Unknown parent class "Ghost"/);
});

test('074_ThisBeforeSuperFails', (t) => {
    //TDZ: обращение к this до super() в ctor extends-класса — ошибка.
    assert.throws(() => {
        executeReturnCode(`
            class A {
                constructor() { this.x = 1; }
            }
            class B extends A {
                constructor() {
                    this.y = 2;
                    super();
                }
            }
            return new B();
        `);
    }, /Must call super constructor/);
});

test('074_SuperOutsideClassFails', (t) => {
    //super в обычной функции — ошибка.
    assert.throws(() => {
        executeReturnCode(`
            function f() { return super.foo(); }
            return f();
        `);
    }, /'super' is not available/);
});

test('074_SuperMethodNotFound', (t) => {
    //super.foo() в классе, у которого ни один родитель не объявил foo.
    assert.throws(() => {
        executeReturnCode(`
            class A {}
            class B extends A {
                run() { return super.missing(); }
            }
            return new B().run();
        `);
    }, /Method 'missing' not found/);
});

test('075_InstanceofBasic', (t) => {
    //instance instanceof класс, которому он принадлежит — true.
    const returnVal = executeReturnCode(`
        class A {}
        return new A() instanceof A;
    `);
    assert.strictEqual(true, returnVal?.value);
});

test('075_InstanceofParent', (t) => {
    //instance дочернего класса — instance and родителя тоже.
    const returnVal = executeReturnCode(`
        class A {}
        class B extends A {}
        b = new B();
        return b instanceof A;
    `);
    assert.strictEqual(true, returnVal?.value);
});

test('075_InstanceofNotParent', (t) => {
    //Параллельные классы не связаны — false.
    const returnVal = executeReturnCode(`
        class A {}
        class B {}
        return new A() instanceof B;
    `);
    assert.strictEqual(false, returnVal?.value);
});

test('075_InstanceofNonObject', (t) => {
    //Левый операнд — не объект. Безопасно false.
    const returnVal = executeReturnCode(`
        class A {}
        return 42 instanceof A;
    `);
    assert.strictEqual(false, returnVal?.value);
});

test('075_InstanceofThreeLevels', (t) => {
    //Цепочка A → B → C. C-instance — экземпляр и A, и B, и C.
    const returnVal = executeReturnCode(`
        class A {}
        class B extends A {}
        class C extends B {}
        c = new C();
        return c instanceof A;
    `);
    assert.strictEqual(true, returnVal?.value);
});

test('075_InstanceofUnknownClassFails', (t) => {
    assert.throws(() => {
        executeReturnCode(`
            return 1 instanceof Ghost;
        `);
    }, /Unknown class "Ghost" in instanceof/);
});

test('075_InstanceofRightNotClassFails', (t) => {
    //Справа должен быть класс или function-конструктор (этап 4). Имя,
    //под которым лежит обычное значение (число, строка, массив) — даёт ошибку.
    assert.throws(() => {
        executeReturnCode(`
            x = 5;
            return 1 instanceof x;
        `);
    }, /Right operand of instanceof must be a class/);
});

test('075_NewErrorIsInstanceofError', (t) => {
    //Унификация: new Error("oops") — экземпляр класса Error.
    const returnVal = executeReturnCode(`
        return new Error("oops") instanceof Error;
    `);
    assert.strictEqual(true, returnVal?.value);
});

test('075_ErrorMessageAndName', (t) => {
    //Унифицированный Error даёт те же поля, что и старый builtin.
    const returnVal = executeReturnCode(`
        e = new Error("boom");
        return e.message + "/" + e.name;
    `);
    assert.strictEqual('boom/Error', returnVal?.value);
});

test('075_CustomErrorExtendsError', (t) => {
    //Пользовательский класс, унаследованный от Error, — экземпляр и Error.
    const returnVal = executeReturnCode(`
        class MyError extends Error {
            constructor(msg) {
                super(msg);
                this.name = "MyError";
            }
        }
        e = new MyError("nope");
        return e.name + "|" + e.message + "|" + (e instanceof Error).toString();
    `);
    assert.strictEqual('MyError|nope|true', returnVal?.value);
});

test('075_SystemErrorIsInstanceofError', (t) => {
    //Системная ошибка интерпретатора (например, обращение к
    //необъявленной переменной) после wrapAsError тоже instance Error.
    const returnVal = executeReturnCode(`
        try {
            undef + 1;
        } catch (e) {
            return e instanceof Error;
        }
        return false;
    `);
    assert.strictEqual(true, returnVal?.value);
});

test('075_ThrowCustomErrorCaughtByInstanceof', (t) => {
    //throw new MyError() — catch различает через instanceof.
    const returnVal = executeReturnCode(`
        class MyError extends Error {
            constructor(m) { super(m); this.name = "MyError"; }
        }
        try {
            throw new MyError("bad");
        } catch (e) {
            if (e instanceof MyError) {
                return "my:" + e.message;
            }
            if (e instanceof Error) {
                return "err:" + e.message;
            }
            return "other";
        }
    `);
    assert.strictEqual('my:bad', returnVal?.value);
});

test('076_FunctionCtorBasic', (t) => {
    //Старый JS-стиль: function-конструктор пишет в this.x.
    const returnVal = executeReturnCode(`
        function Point(x, y) {
            this.x = x;
            this.y = y;
        }
        p = new Point(3, 4);
        return p.x + p.y;
    `);
    assert.strictEqual(7, returnVal?.value);
});

test('076_FunctionCtorMethodOnInstance', (t) => {
    //Методы цепляются как свойства instance внутри конструктора.
    const returnVal = executeReturnCode(`
        function Counter(start) {
            this.value = start;
            this.inc = function(by) {
                this.value = this.value + by;
                return this.value;
            };
        }
        c = new Counter(10);
        c.inc(2);
        c.inc(3);
        return c.inc(4);
    `);
    assert.strictEqual(19, returnVal?.value);
});

test('076_FunctionCtorInstanceof', (t) => {
    //instance созданный через new Foo() — instanceof Foo.
    const returnVal = executeReturnCode(`
        function User(name) { this.name = name; }
        return new User("Anna") instanceof User;
    `);
    assert.strictEqual(true, returnVal?.value);
});

test('076_FunctionCtorInstanceofWrapperShared', (t) => {
    //Два разных вызова new Foo() дают instance того же класса-обёртки —
    //иначе instanceof a-instance с обёрткой b-instance дал бы false.
    const returnVal = executeReturnCode(`
        function Bag() {}
        a = new Bag();
        b = new Bag();
        return (a instanceof Bag) && (b instanceof Bag);
    `);
    assert.strictEqual(true, returnVal?.value);
});

test('076_FunctionCallWithoutNewFails', (t) => {
    //Вызов функции-конструктора без new — обычная функция, this недоступен.
    assert.throws(() => {
        executeReturnCode(`
            function User(name) { this.name = name; }
            User("Anna");
            return 0;
        `);
    }, /'this' is not available/);
});

test('076_FunctionCtorTwoIndependentInstances', (t) => {
    //Два instance, созданные через function-конструктор, не делят состояние.
    const returnVal = executeReturnCode(`
        function C() {
            this.value = 0;
            this.inc = function() { this.value = this.value + 1; return this.value; };
        }
        a = new C();
        b = new C();
        a.inc(); a.inc(); a.inc();
        b.inc();
        return a.value + 100 * b.value;
    `);
    assert.strictEqual(103, returnVal?.value);
});

test('076_NewOnNonFunctionFails', (t) => {
    //new по имени, под которым лежит не класс и не функция — ошибка.
    assert.throws(() => {
        executeReturnCode(`
            x = 5;
            return new x();
        `);
    }, /"x" is not a constructor/);
});

test('076_FunctionCtorClassMethodMix', (t) => {
    //Метод класса работает рядом с function-конструктором: оба пути
    //разрешаются в selfFuncCallFinishHandler.
    const returnVal = executeReturnCode(`
        class A {
            greet() { return "hi"; }
        }
        function B() {
            this.greet = function() { return "hello"; };
        }
        a = new A();
        b = new B();
        return a.greet() + "/" + b.greet();
    `);
    assert.strictEqual('hi/hello', returnVal?.value);
});

test('076_FunctionCtorReturnsInstance', (t) => {
    //Если в function-конструкторе вызван return примитива — он
    //игнорируется. Возвращается всегда созданный instance (этап 1).
    const returnVal = executeReturnCode(`
        function F() {
            this.x = 42;
            return 0;
        }
        return new F().x;
    `);
    assert.strictEqual(42, returnVal?.value);
});

// ===== 077: let / var / const =====

test('077_LetSimple', () => {
    const r = executeReturnCode('let x = 5; return x;');
    assert.strictEqual(5, r?.value);
});

// P1-22: зеркало PHP Test.php testMSLang077_VarRedeclaresLetFails (перенесён из bugs.ts,
// чтобы пары файлов совпадали: tests.ts ↔ Test.php).
test('077_VarRedeclaresLetFails', () => {
    assert.throws(() => executeReturnCode('let x = 1; let x = 2; return x;'),
        /Identifier 'x' has already been declared/);
});

test('077_LetWithoutInitIsNull', () => {
    const r = executeReturnCode('let x; return x;');
    assert.strictEqual(VariableType.vtNull, r?.type);
});

test('077_LetMultipleInOneStatement', () => {
    const r = executeReturnCode('let a = 1, b = 2, c = 3; return a + b + c;');
    assert.strictEqual(6, r?.value);
});

test('077_LetBlockScopeInsideIf', () => {
    const r = executeReturnCode('let x = 1; if (true) { let x = 99; } return x;');
    assert.strictEqual(1, r?.value);
});

test('077_LetBlockScopeStandalone', () => {
    assert.throws(() => {
        executeReturnCode('if (true) { let z = 5; } return z;');
    }, /variable not defined z/);
});

test('077_LetInWhile', () => {
    const r = executeReturnCode(`
        let sum = 0;
        let i = 0;
        while (i < 5) {
            let step = i + 1;
            sum = sum + step;
            i = i + 1;
        }
        return sum;
    `);
    assert.strictEqual(15, r?.value);
});

test('077_LetTDZRead', () => {
    assert.throws(() => {
        executeReturnCode('return x; let x = 5;');
    }, /Cannot access 'x' before initialization/);
});

test('077_LetTDZReadInFunction', () => {
    assert.throws(() => {
        executeReturnCode('function f() { return x; let x = 42; } return f();');
    }, /Cannot access 'x' before initialization/);
});

test('077_LetRedeclarationInSameBlockFails', () => {
    assert.throws(() => {
        executeReturnCode('let x = 1; let x = 2; return x;');
    }, /Identifier 'x' has already been declared/);
});

test('077_LetRedeclarationAcrossBlocksOK', () => {
    const r = executeReturnCode(`
        let r = 0;
        if (true) {
            let r = 10;
        }
        if (true) {
            let r = 20;
        }
        return r;
    `);
    assert.strictEqual(0, r?.value);
});

// ===== const =====

test('077_ConstSimple', () => {
    const r = executeReturnCode('const x = 7; return x;');
    assert.strictEqual(7, r?.value);
});

test('077_ConstAssignmentFails', () => {
    assert.throws(() => {
        executeReturnCode('const x = 7; x = 8; return x;');
    }, /Cannot override constant/);
});

test('077_ConstRequiresInitializer', () => {
    assert.throws(() => {
        executeReturnCode('const x; return 0;');
    }, /'const' declaration of "x" requires an initializer/);
});

test('077_ConstObjectFieldsCanChange', () => {
    const r = executeReturnCode(`
        class C { constructor() { this.v = 0; } }
        const c = new C();
        c.v = 42;
        return c.v;
    `);
    assert.strictEqual(42, r?.value);
});

test('077_ConstRedeclarationInSameBlockFails', () => {
    assert.throws(() => {
        executeReturnCode('const x = 1; const x = 2; return x;');
    }, /Identifier 'x' has already been declared/);
});

test('077_LetThenConstSameNameFails', () => {
    assert.throws(() => {
        executeReturnCode('let x = 1; const x = 2; return x;');
    }, /Identifier 'x' has already been declared/);
});

// ===== var =====

test('077_VarSimple', () => {
    const r = executeReturnCode('var x = 5; return x;');
    assert.strictEqual(5, r?.value);
});

test('077_VarHoistingReturnsNull', () => {
    const r = executeReturnCode('function f() { return x; var x = 42; } return f();');
    assert.strictEqual(VariableType.vtNull, r?.type);
});

test('077_VarInsideIfLeaksOut', () => {
    const r = executeReturnCode(`
        function f() {
            if (true) {
                var y = 99;
            }
            return y;
        }
        return f();
    `);
    assert.strictEqual(99, r?.value);
});

test('077_VarRedeclarationOK', () => {
    const r = executeReturnCode('var x = 1; var x = 2; return x;');
    assert.strictEqual(2, r?.value);
});

test('077_VarInLoop', () => {
    const r = executeReturnCode(`
        function f() {
            var sum = 0;
            var i = 0;
            while (i < 4) {
                sum = sum + i;
                i = i + 1;
            }
            return sum;
        }
        return f();
    `);
    assert.strictEqual(6, r?.value);
});

test('077_VarHoistedThroughNestedBlocks', () => {
    const r = executeReturnCode(`
        function f() {
            if (true) {
                if (true) {
                    if (true) {
                        var deep = 7;
                    }
                }
            }
            return deep;
        }
        return f();
    `);
    assert.strictEqual(7, r?.value);
});

test('077_VarStaysInsideFunction', () => {
    const r = executeReturnCode(`
        function outer() {
            function inner() {
                var inside = 100;
            }
            inner();
            return 0;
        }
        return outer();
    `);
    assert.strictEqual(0, r?.value);
});

// ===== Совместимость со старым кодом =====

test('077_LegacyImplicitAssignmentStillWorks', () => {
    const r = executeReturnCode('x = 1; y = 2; return x + y;');
    assert.strictEqual(3, r?.value);
});

test('077_LegacyClosureWalkStillWorks', () => {
    const r = executeReturnCode(`
        function outer() {
            n = 100;
            function bump() { n = n + 1; return n; }
            return bump();
        }
        return outer();
    `);
    assert.strictEqual(101, r?.value);
});

test('077_LetFixesClosureWalkBug', () => {
    const r = executeReturnCode(`
        function inner(n) {
            let i = 0;
            while (i < n) i = i + 1;
            return i;
        }
        function outer() {
            let i = 0;
            let count = 0;
            while (i < 3) {
                inner(10);
                count = count + 1;
                i = i + 1;
            }
            return count;
        }
        return outer();
    `);
    assert.strictEqual(3, r?.value);
});

// ===== Вложенность и комбинации =====

test('077_LetInsideClassMethod', () => {
    const r = executeReturnCode(`
        class C {
            run() {
                let a = 10;
                let b = 20;
                return a + b;
            }
        }
        return new C().run();
    `);
    assert.strictEqual(30, r?.value);
});

test('077_ConstWithExpressionInit', () => {
    const r = executeReturnCode(`
        const a = 1;
        const b = 2;
        const c = a + b + 10;
        return c;
    `);
    assert.strictEqual(13, r?.value);
});

test('077_LetInForBody', () => {
    const r = executeReturnCode(`
        sum = 0;
        for (i = 0; i < 5; i++) {
            let step = i + 1;
            sum = sum + step;
        }
        return sum;
    `);
    assert.strictEqual(15, r?.value);
});

test('077_TryCatchLetVisibility', () => {
    const r = executeReturnCode(`
        let result = "before";
        try {
            let x = 1;
            throw "oops";
        } catch (e) {
            result = "caught";
        }
        return result;
    `);
    assert.strictEqual('caught', r?.value);
});

test('077_LetInsideCatchBlock', () => {
    assert.throws(() => {
        executeReturnCode(`
            try {
                throw "x";
            } catch (e) {
                let inside = 42;
            }
            return inside;
        `);
    }, /variable not defined inside/);
});

test('077_DeepNestedLetIsolation', () => {
    const r = executeReturnCode(`
        let acc = 0;
        let i = 0;
        while (i < 2) {
            let j = 0;
            while (j < 3) {
                let k = j * 10 + i;
                acc = acc + k;
                j = j + 1;
            }
            i = i + 1;
        }
        return acc;
    `);
    // (i=0): 0+10+20=30; (i=1): 1+11+21=33. Итого 63.
    assert.strictEqual(63, r?.value);
});


// ===== new Array(...) — нативный конструктор массива =====

test('078_NewArrayEmpty', () => {
    // `new Array()` без аргументов даёт пустой массив. Длина 0.
    const r = executeReturnCode('let a = new Array(); return a.length;');
    assert.strictEqual(0, r?.value);
});

test('078_NewArrayWithLength', () => {
    // `new Array(N)` с целым неотрицательным N — массив длиной N,
    // ячейки undefined. Это и есть JS-семантика.
    const r = executeReturnCode('let a = new Array(5); return a.length;');
    assert.strictEqual(5, r?.value);
});

test('078_NewArrayFillZero', () => {
    // Типичная связка: `new Array(N).fill(0)` — массив нулей длины N.
    // Используется как замена `let a = []; for (...) a.push(0);`.
    const r = executeReturnCode(`
        let a = new Array(4).fill(0);
        return (a[0] + a[1] + a[2] + a[3]).toString() + "/" + a.length.toString();
    `);
    assert.strictEqual('0/4', r?.value);
});

test('078_NewArrayFromArgs', () => {
    // `new Array(a, b, c)` где аргументов больше одного — это литерал [a, b, c].
    const r = executeReturnCode(`
        let a = new Array(7, 8, 9);
        return (a[0] + a[1] + a[2]).toString() + "/" + a.length.toString();
    `);
    assert.strictEqual('24/3', r?.value);
});

test('078_NewArrayNegativeLengthFails', () => {
    // Отрицательная длина — ошибка (как в JS: RangeError).
    assert.throws(() => {
        executeReturnCode('let a = new Array(-1); return a.length;');
    }, /Invalid array length/);
});

test('079_Json', () => {
    // JSON.parse / JSON.stringify — зеркально с PHP-эталоном (гейт — cross-runtime
    // 041-json и дифф-фаззер). JSON-строки в скриптах берём в одинарные кавычки MSLang.
    assert.strictEqual(1, executeReturnCode(`return JSON.parse('{"a":1}').a;`)?.value);
    assert.strictEqual(1, executeReturnCode(`return JSON.parse('{"a":1}')["a"];`)?.value);
    assert.strictEqual(20, executeReturnCode(`return JSON.parse('[10,20,30]')[1];`)?.value);
    assert.strictEqual('Ann', executeReturnCode(`return JSON.parse('{"u":{"name":"Ann"}}').u.name;`)?.value);
    assert.strictEqual('{"a":1,"b":[2,3]}', executeReturnCode(`return JSON.stringify(JSON.parse('{"a":1,"b":[2,3]}'));`)?.value);
    // ассоциативный массив → объект, список → массив
    assert.strictEqual('{"a":1,"b":2}', executeReturnCode(`return JSON.stringify(["a" => 1, "b" => 2]);`)?.value);
    assert.strictEqual('[1,2,3]', executeReturnCode(`return JSON.stringify([1, 2, 3]);`)?.value);
    // пустой объект и пустой массив различимы (путь А)
    assert.strictEqual('{}', executeReturnCode(`return JSON.stringify(JSON.parse('{}'));`)?.value);
    assert.strictEqual('[]', executeReturnCode(`return JSON.stringify(JSON.parse('[]'));`)?.value);
    // числа: дробь через единый форматтер, NaN/Infinity → null
    assert.strictEqual('0.30000000000000004', executeReturnCode(`return JSON.stringify(0.1 + 0.2);`)?.value);
    assert.strictEqual('null', executeReturnCode(`return JSON.stringify(5 / 0);`)?.value);
    assert.strictEqual('null', executeReturnCode(`return JSON.stringify(0 / 0);`)?.value);
    // функция: в массиве → null, у ключа → выброшен
    assert.strictEqual('[1,null,2]', executeReturnCode(`return JSON.stringify([1, null, 2]);`)?.value);
    assert.strictEqual('{"a":1}', executeReturnCode(`return JSON.stringify(["a" => 1, "b" => (x => x)]);`)?.value);
    // ошибка разбора → default; валидный null ошибкой не считается
    assert.strictEqual('fb', executeReturnCode(`return JSON.parse('oops', "fb");`)?.value);
    assert.strictEqual('null', executeReturnCode(`return JSON.stringify(JSON.parse('null'));`)?.value);
    // числовые ключи объекта печатаются как JS: по возрастанию, затем строки
    assert.strictEqual('{"1":"b","3":"a","x":"c"}', executeReturnCode(`return JSON.stringify(JSON.parse('{"3":"a","1":"b","x":"c"}'));`)?.value);
    // кириллица — сырой UTF-8 (без \\u), слэш не экранируется
    assert.strictEqual('"привет /x"', executeReturnCode(`return JSON.stringify("привет /x");`)?.value);
    // экземпляр класса (new O()) перечисляется как объект, а не схлопывается в {}
    // (баг: TASK-json-stringify-host-objects)
    assert.strictEqual('{"url":"x"}', executeReturnCode(`class O {} var t = new O(); t.url = "x"; return JSON.stringify(t);`)?.value);
    // вложенный литерал с экземплярами классов — сценарий ноды БП action.mail.send
    assert.strictEqual(
        '{"task":{"url":"http://x/tasks/9"},"user":{"email":"a@b.io"}}',
        executeReturnCode(`class O {} var task = new O(); task.url = "http://x/tasks/9"; var user = new O(); user.email = "a@b.io"; return JSON.stringify({"task": task, "user": user});`)?.value,
    );
    // метод (значение-функция) на экземпляре в объект не попадает — как в JS
    assert.strictEqual('{"n":7}', executeReturnCode(`function F() { this.n = 7; this.m = function() { return 1; }; } var f = new F(); return JSON.stringify(f);`)?.value);
    // впрыснутый хост-объект (setVariable + StackVariableObject) — как $.in.<нода> в CRM
    {
        const context = createCodeContext(`return JSON.stringify({"task": task, "user": user});`);
        const task = new StackVariableObject(false, {});
        task.registerProperty('url', new StackVariableString(false, 'http://x/tasks/9'));
        const user = new StackVariableObject(false, {});
        user.registerProperty('email', new StackVariableString(false, 'a@b.io'));
        context.setVariable('task', task);
        context.setVariable('user', user);
        assert.strictEqual('{"task":{"url":"http://x/tasks/9"},"user":{"email":"a@b.io"}}', context.exec(true)?.value);
    }
});

test('080_ObjectKeysValuesEntries', () => {
    // Object.keys/values/entries — перечисление объекта/массива/строки в JS-порядке.
    // Гейт — cross-runtime 042-object-keys.
    assert.strictEqual('["a","b"]', executeReturnCode(`return JSON.stringify(Object.keys(JSON.parse('{"a":1,"b":2}')));`)?.value);
    assert.strictEqual('[1,2]', executeReturnCode(`return JSON.stringify(Object.values(JSON.parse('{"a":1,"b":2}')));`)?.value);
    assert.strictEqual('[["a",1],["b",2]]', executeReturnCode(`return JSON.stringify(Object.entries(JSON.parse('{"a":1,"b":2}')));`)?.value);
    // массив: ключи — строковые индексы, значения — элементы
    assert.strictEqual('["0","1","2"]', executeReturnCode(`return JSON.stringify(Object.keys([10, 20, 30]));`)?.value);
    assert.strictEqual('[10,20,30]', executeReturnCode(`return JSON.stringify(Object.values([10, 20, 30]));`)?.value);
    // числовые ключи объекта — по возрастанию, затем строковые по вставке
    assert.strictEqual('["1","3","x"]', executeReturnCode(`return JSON.stringify(Object.keys(JSON.parse('{"3":1,"1":2,"x":3}')));`)?.value);
    // ассоциативный массив-карта
    assert.strictEqual('["k1","k2"]', executeReturnCode(`return JSON.stringify(Object.keys(["k1" => 1, "k2" => 2]));`)?.value);
    // строка — по символам (код-поинты), как JS
    assert.strictEqual('["0","1","2"]', executeReturnCode(`return JSON.stringify(Object.keys("abc"));`)?.value);
    assert.strictEqual(6, executeReturnCode(`return Object.keys("привет").length;`)?.value);
    // не объект/массив/строка → пусто
    assert.strictEqual('[]', executeReturnCode(`return JSON.stringify(Object.keys(5));`)?.value);
    // полный обход: Object.keys + for + obj[key]
    assert.strictEqual('a=1;b=2;c=3;', executeReturnCode(`let o = JSON.parse('{"a":1,"b":2,"c":3}'); let ks = Object.keys(o); let s = ""; for (let i = 0; i < ks.length; i++) { s = s + ks[i] + "=" + o[ks[i]].toString() + ";"; } return s;`)?.value);
});

test('081_StringMethods', () => {
    // split/replace/replaceAll/repeat/slice — литеральные, зеркально с PHP-эталоном.
    // Гейт — cross-runtime 043-string-methods + дифф-фаззер.
    assert.strictEqual('["a","b","c"]', executeReturnCode(`return JSON.stringify("a,b,c".split(","));`)?.value);
    assert.strictEqual('["a","b"]', executeReturnCode(`return JSON.stringify("a,b,c".split(",", 2));`)?.value);
    assert.strictEqual('["a","b","c"]', executeReturnCode(`return JSON.stringify("abc".split(""));`)?.value);
    assert.strictEqual('["abc"]', executeReturnCode(`return JSON.stringify("abc".split());`)?.value);
    assert.strictEqual('Z-y-x', executeReturnCode(`return "x-y-x".replace("x", "Z");`)?.value);
    assert.strictEqual('Z-y-Z', executeReturnCode(`return "x-y-x".replaceAll("x", "Z");`)?.value);
    assert.strictEqual('Xabc', executeReturnCode(`return "abc".replace("", "X");`)?.value);
    assert.strictEqual('ababab', executeReturnCode(`return "ab".repeat(3);`)?.value);
    assert.strictEqual('', executeReturnCode(`return "ab".repeat(0);`)?.value);
    assert.strictEqual('bcd', executeReturnCode(`return "abcde".slice(1, -1);`)?.value);
    assert.strictEqual('de', executeReturnCode(`return "abcde".slice(-2);`)?.value);
    assert.strictEqual('рим', executeReturnCode(`return "пример".slice(1, 4);`)?.value);

    // repeat с отрицательным count — ошибка (как JS RangeError)
    assert.throws(() => {
        executeReturnCode(`return "x".repeat(-1);`);
    }, /Invalid count value/);
});

test('082_StringPadTrim', () => {
    // padStart/padEnd/trimStart/trimEnd — зеркально с PHP-эталоном (cross 044).
    assert.strictEqual('00042', executeReturnCode(`return "42".padStart(5, "0");`)?.value);
    assert.strictEqual('42000', executeReturnCode(`return "42".padEnd(5, "0");`)?.value);
    assert.strictEqual('  5', executeReturnCode(`return "5".padStart(3);`)?.value);
    assert.strictEqual('1231231abc', executeReturnCode(`return "abc".padStart(10, "123");`)?.value);
    assert.strictEqual('abc', executeReturnCode(`return "abc".padStart(2);`)?.value);
    assert.strictEqual('5', executeReturnCode(`return "5".padStart(3, "");`)?.value);
    assert.strictEqual('hi  ', executeReturnCode(`return "  hi  ".trimStart();`)?.value);
    assert.strictEqual('  hi', executeReturnCode(`return "  hi  ".trimEnd();`)?.value);
});

test('083_NumberFunctions', () => {
    // Number.parseInt/parseFloat/isX + num.toFixed — зеркально с PHP-эталоном (cross 044 + фаззер).
    assert.strictEqual(120, executeReturnCode(`return Number.parseInt("120 руб");`)?.value);
    assert.strictEqual(26, executeReturnCode(`return Number.parseInt("0x1A");`)?.value);
    assert.strictEqual(35, executeReturnCode(`return Number.parseInt("z", 36);`)?.value);
    assert.strictEqual(true, executeReturnCode(`return Number.parseInt("abc").isNaN;`)?.value);
    assert.strictEqual(12.5, executeReturnCode(`return Number.parseFloat("12.5px");`)?.value);
    assert.strictEqual(0.5, executeReturnCode(`return Number.parseFloat(".5");`)?.value);
    assert.strictEqual(true, executeReturnCode(`return Number.parseFloat("xyz").isNaN;`)?.value);
    // toFixed: половина вверх (2.5→3), fp-край (1.005 реально < .005 → 1.00)
    assert.strictEqual('3.14', executeReturnCode(`return (3.14159).toFixed(2);`)?.value);
    assert.strictEqual('1.00', executeReturnCode(`return (1).toFixed(2);`)?.value);
    assert.strictEqual('3', executeReturnCode(`return (2.5).toFixed(0);`)?.value);
    assert.strictEqual('1.00', executeReturnCode(`return (1.005).toFixed(2);`)?.value);
    // строгие проверки — строка не приводится
    assert.strictEqual(true, executeReturnCode(`return Number.isInteger(5);`)?.value);
    assert.strictEqual(false, executeReturnCode(`return Number.isInteger(5.5);`)?.value);
    assert.strictEqual(false, executeReturnCode(`return Number.isInteger("5");`)?.value);
    assert.strictEqual(true, executeReturnCode(`return Number.isNaN(0 / 0);`)?.value);
    assert.strictEqual(false, executeReturnCode(`return Number.isFinite(1 / 0);`)?.value);

    // toFixed вне диапазона 0..100 — ошибка
    assert.throws(() => {
        executeReturnCode(`return (1).toFixed(200);`);
    }, /between 0 and 100/);
});

test('084_ObjectMapOps', () => {
    // Object.get/has/assign/fromEntries — операции над картами (cross 045).
    assert.strictEqual('Moscow', executeReturnCode(`return Object.get(JSON.parse('{"a":{"b":{"c":"Moscow"}}}'), "a.b.c");`)?.value);
    assert.strictEqual('def', executeReturnCode(`return Object.get(JSON.parse('{"a":1}'), "a.b", "def");`)?.value);
    assert.strictEqual('y', executeReturnCode(`return Object.get(JSON.parse('{"items":[{"n":"x"},{"n":"y"}]}'), "items.1.n");`)?.value);
    assert.strictEqual(true, executeReturnCode(`return Object.has(JSON.parse('{"a":{"b":1}}'), "a.b");`)?.value);
    assert.strictEqual(false, executeReturnCode(`return Object.has(JSON.parse('{"a":1}'), "a.b");`)?.value);
    // null — то же отсутствие: get вернёт default, has → false
    assert.strictEqual('def', executeReturnCode(`return Object.get(JSON.parse('{"a":null}'), "a", "def");`)?.value);
    assert.strictEqual(false, executeReturnCode(`return Object.has(JSON.parse('{"a":null}'), "a");`)?.value);
    // assign: правый побеждает, изменяет и возвращает target
    assert.strictEqual('{"x":1,"y":9,"z":3}', executeReturnCode(`return JSON.stringify(Object.assign(JSON.parse('{}'), JSON.parse('{"x":1,"y":2}'), JSON.parse('{"y":9,"z":3}')));`)?.value);
    // fromEntries: сборка объекта из пар + round-trip с entries
    assert.strictEqual('{"a":1,"b":2}', executeReturnCode(`return JSON.stringify(Object.fromEntries([["a", 1], ["b", 2]]));`)?.value);
    assert.strictEqual('{"x":1,"y":2}', executeReturnCode(`return JSON.stringify(Object.fromEntries(Object.entries(JSON.parse('{"x":1,"y":2}'))));`)?.value);
});

test('085_ArrayHigherOrder', () => {
    // map/filter/reduce/forEach/find/findIndex/some/every — колбэк через стек-машину (cross 046).
    assert.strictEqual('[2,4,6]', executeReturnCode(`return JSON.stringify([1,2,3].map(function(x){return x * 2;}));`)?.value);
    assert.strictEqual('[2,4]', executeReturnCode(`return JSON.stringify([1,2,3,4].filter(function(x){return x % 2 == 0;}));`)?.value);
    assert.strictEqual(10, executeReturnCode(`return [1,2,3,4].reduce(function(a,b){return a + b;}, 0);`)?.value);
    assert.strictEqual(6, executeReturnCode(`return [1,2,3].reduce(function(a,b){return a + b;});`)?.value);
    assert.strictEqual(3, executeReturnCode(`return [1,2,3,4].find(function(x){return x > 2;});`)?.value);
    assert.strictEqual(2, executeReturnCode(`return [1,2,3,4].findIndex(function(x){return x > 2;});`)?.value);
    assert.strictEqual(true, executeReturnCode(`return [1,2,3].some(function(x){return x > 2;});`)?.value);
    assert.strictEqual(false, executeReturnCode(`return [1,2,3].every(function(x){return x > 1;});`)?.value);
    // индекс в колбэке
    assert.strictEqual('[0,1,2]', executeReturnCode(`return JSON.stringify([10,20,30].map(function(x, i){return i;}));`)?.value);
    // forEach со замыканием (запись наружу)
    assert.strictEqual(6, executeReturnCode(`let a = [1,2,3]; let s = 0; a.forEach(function(x){s = s + x;}); return s;`)?.value);
    // цепочка filter→map→reduce
    assert.strictEqual(50, executeReturnCode(`let a = [1,2,3,4,5]; return a.filter(function(x){return x > 2;}).map(function(x){return x * x;}).reduce(function(s,x){return s + x;}, 0);`)?.value);
    // вложенный map
    assert.strictEqual('[[10,20],[20,40]]', executeReturnCode(`let a = [1,2]; return JSON.stringify(a.map(function(x){return [10,20].map(function(y){return x * y;});}));`)?.value);

    // reduce пустого без начального — ошибка; map с не-функцией — ошибка
    assert.throws(() => {
        executeReturnCode(`let a = []; return a.reduce(function(x,y){return x + y;});`);
    }, /Reduce of empty array/);
    assert.throws(() => {
        executeReturnCode(`let a = [1,2]; return a.map(5);`);
    }, /callback is not a function/);
});

test('086_ArrayListMethods', () => {
    // slice/splice/sort/flat + Array.isArray/from (cross 048).
    assert.strictEqual('[2,3]', executeReturnCode(`let a=[1,2,3,4,5]; return JSON.stringify(a.slice(1,3));`)?.value);
    assert.strictEqual('[4,5]', executeReturnCode(`let a=[1,2,3,4,5]; return JSON.stringify(a.slice(-2));`)?.value);
    // splice: удаляет, вставляет, возвращает удалённые, изменяет массив
    assert.strictEqual('[2,3]#[1,99,4]', executeReturnCode(`let a=[1,2,3,4]; let r=a.splice(1,2,99); return JSON.stringify(r) + "#" + JSON.stringify(a);`)?.value);
    // sort — по строковому виду (JS-компаратор по умолчанию)
    assert.strictEqual('[1,10,100,2,9]', executeReturnCode(`let a=[10,9,1,100,2]; a.sort(); return JSON.stringify(a);`)?.value);
    assert.strictEqual('["apple","banana"]', executeReturnCode(`let a=["banana","apple"]; a.sort(); return JSON.stringify(a);`)?.value);
    // flat
    assert.strictEqual('[1,2,[3]]', executeReturnCode(`let a=[1,[2,[3]]]; return JSON.stringify(a.flat());`)?.value);
    assert.strictEqual('[1,2,3]', executeReturnCode(`let a=[1,[2,[3]]]; return JSON.stringify(a.flat(2));`)?.value);
    // Array.isArray / from (раньше `Array` было зарезервированным словом — теперь нет)
    assert.strictEqual(true, executeReturnCode(`return Array.isArray([1,2]);`)?.value);
    assert.strictEqual(false, executeReturnCode(`return Array.isArray(5);`)?.value);
    assert.strictEqual('["a","b","c"]', executeReturnCode(`return JSON.stringify(Array.from("abc"));`)?.value);
    assert.strictEqual('[1,2,3]', executeReturnCode(`let a=[1,2,3]; return JSON.stringify(Array.from(a));`)?.value);
});

test('087_LogicalOperators', () => {
    const rc = (src: string) => executeReturnCode(src)?.value;

    // && / || принимают и возвращают только boolean.
    assert.strictEqual(false, rc('return true && false;'));
    assert.strictEqual(true, rc('return false || true;'));
    assert.strictEqual(true, rc('let x = 5; let y = 3; return x > 0 && y > 0;'));

    // Не-boolean слева или справа — NotBoolean (раньше возвращался сам операнд).
    for (const expr of ['6 && true', 'true && 1', '0 || false', 'false || "x"', 'null && true', '"a" && "b"']) {
        assert.strictEqual('NotBoolean', errorOf(`return ${expr};`)?.getErrorCode(), expr);
    }

    // Сокращённое вычисление: правый операнд не вычисляется вовсе — даже ошибочный.
    assert.strictEqual(0, rc('let c = 0; let r = false && (c = c + 1) > 0; return c;'));
    assert.strictEqual(0, rc('let c = 0; let r = true || (c = c + 1) > 0; return c;'));
    assert.strictEqual(false, rc('return false && nope;'));

    // Приоритет: && сильнее ||. Раньше ранний выход прыгал в конец всего выражения,
    // и `false && x || true` давало false.
    assert.strictEqual(true, rc('return false && nope || true;'));
    assert.strictEqual('yes', rc('if (false && nope || true) { return "yes"; } return "no";'));
    assert.strictEqual(true, rc('return true || nope && false;'));
    assert.strictEqual(false, rc('return (true || false) && false;'));
    assert.strictEqual(true, rc('let a = 2; return a * 2 == 4 && a * 3 == 6;'));
    assert.strictEqual(true, rc('let t = true; let a = 2; return t && a * 3 == 6;'));

    // Приоритет математики в условии тернарного оператора (раньше 1 + 2 * 3 считалось как 9).
    assert.strictEqual('y', rc('return 1 + 2 * 3 == 7 ? "y" : "n";'));
});

test('088_Truthiness', () => {
    // Условие — только boolean, во всех местах одна ошибка NotBoolean.
    // Значения, которые раньше считались «истинными» или «ложными» по JS.
    const values = ['1', '0', '(0/0)', '"0"', '""', 'null', '[]', '[1]', 'JSON.parse("{}")', 'DateTime.Now'];
    const contexts = [
        'if (%s) { return 1; } return 2;',
        'let r = 0; while (%s) { r = 1; break; } return r;',
        'let r = 0; for (; %s;) { r = 1; break; } return r;',
        'return (%s) ? 1 : 2;',
        'return !(%s);',
        'return (%s) && true;',
        'return true && (%s);',
        'return (%s) || false;',
        'return false || (%s);',
        'return [1].filter(function(x){ return %s; });',
        'return [1].find(function(x){ return %s; });',
        'return [1].findIndex(function(x){ return %s; });',
        'return [1].some(function(x){ return %s; });',
        'return [1].every(function(x){ return %s; });',
    ];
    for (const context of contexts) {
        for (const value of values) {
            const script = context.replace('%s', value);
            assert.strictEqual('NotBoolean', errorOf(script)?.getErrorCode(), script);
        }
        // boolean проходит.
        assert.strictEqual(null, errorOf(context.replace('%s', 'true')), context);
    }

    // Текст ошибки называет место и тип.
    assert.strictEqual('Expected boolean in if, got number', errorOf('if (1) { return 1; }')?.getRawMessage());
    assert.strictEqual('Expected boolean in &&, got string', errorOf('return "a" && true;')?.getRawMessage());
    assert.strictEqual('Expected boolean in filter callback, got number', errorOf('return [1].filter(x => 1);')?.getRawMessage());

    // map/reduce/forEach не требуют boolean.
    assert.strictEqual(2, (executeReturnCode('return [1].map(x => x * 2)[0];') as StackVariable)?.value);
});

test('089_LooseEqualNullString', () => {
    // `==` / `!=` без приведения типов: значения разных типов не равны никогда.
    // Раньше `==` жил по правилам PHP (null == 0, "0" == false — истина).
    assert.strictEqual(false, executeReturnCode('return null == "0";')?.value, 'null == "0"');
    assert.strictEqual(false, executeReturnCode('return "0" == null;')?.value, '"0" == null');
    assert.strictEqual(false, executeReturnCode('return null == "";')?.value, 'null == ""');
    assert.strictEqual(false, executeReturnCode('return null == 0;')?.value, 'null == 0');
    assert.strictEqual(false, executeReturnCode('return null == false;')?.value, 'null == false');
    assert.strictEqual(false, executeReturnCode('return "0" == false;')?.value, '"0" == false');
    assert.strictEqual(false, executeReturnCode('return 0 == "";')?.value, '0 == ""');
    assert.strictEqual(false, executeReturnCode('return 1 == "1";')?.value, '1 == "1"');
    assert.strictEqual(false, executeReturnCode('return "1" == "01";')?.value, '"1" == "01"');
    assert.strictEqual(true, executeReturnCode('return null == null;')?.value, 'null == null');
    assert.strictEqual(false, executeReturnCode('return [null] == ["0"];')?.value, '[null] == ["0"]');
    assert.strictEqual(true, executeReturnCode('return 1 != "1";')?.value, '1 != "1"');
    assert.strictEqual(true, executeReturnCode('return null != 0;')?.value, 'null != 0');
});

test('090_StringTypeName', () => {
    // Имя типа строки в typeName — это 'string'. Раньше для строки ветки
    // switch не было, и она проваливалась в запасной путь: PHP выдавал имя
    // константы 'vtString', а TS-зеркало — 'string'. Это расходилось в тексте
    // ошибок (например, у instanceof). Теперь обе стороны дают чистое 'string'.
    assert.strictEqual('string', new StackVariableString(false, 'x').typeName);

    // То же имя видно в тексте ошибки: правый операнд instanceof — строка.
    // Возвращаем кусок после "got ", чтобы не зависеть от позиции в тексте.
    const script = `var a = 5; var b = "x"; try { return a instanceof b; }`
        + ` catch(e) { return e.message.split("got ")[1]; }`;
    assert.strictEqual('string', executeReturnCode(script)?.value);
});

test('091_ObjectLiteral', () => {
    // Литерал объекта `{ key: value }` → StackVariablePlainObject (как JSON.parse).
    // Ключ — имя (a) или строка ("a"); значение — любое выражение. Доступ через
    // .key и ["key"]; порядок ключей при печати JS-каноничный.
    assert.strictEqual('{"a":1}', executeReturnCode(`return JSON.stringify({a:1});`)?.value);
    assert.strictEqual(3, executeReturnCode(`var o = {a:1, b:2}; return o.a + o.b;`)?.value);
    assert.strictEqual(5, executeReturnCode(`return {"k": 5}["k"];`)?.value);
    assert.strictEqual('{}', executeReturnCode(`return JSON.stringify({});`)?.value);

    // Вложенность объект/массив.
    assert.strictEqual(2, executeReturnCode(`var o = {a:1, b:{c:2}}; return o.b.c;`)?.value);
    assert.strictEqual('{"x":[1,2],"y":"hi"}', executeReturnCode(`return JSON.stringify({x:[1,2], y:"hi"});`)?.value);

    // Висячая запятая допустима.
    assert.strictEqual(1, executeReturnCode(`var o = {a:1,}; return o.a;`)?.value);

    // Порядок ключей JS-каноничный: целые индексы по возрастанию, затем по вставке.
    assert.strictEqual('{"2":"y","10":"x","b":2,"a":1}', executeReturnCode(`return JSON.stringify({b:2, a:1, "10":"x", "2":"y"});`)?.value);

    // Повторный ключ — побеждает последний (как в JS).
    assert.strictEqual('{"a":2}', executeReturnCode(`return JSON.stringify({a:1, a:2});`)?.value);

    // Значение по значению, а не по ссылке: позднее изменение x не трогает o.k.
    assert.strictEqual(5, executeReturnCode(`var x = 5; var o = {k:x}; x = 9; return o.k;`)?.value);

    // Значение — выражение.
    assert.strictEqual('{"a":3,"b":true}', executeReturnCode(`return JSON.stringify({a:1+2, b: 1 < 2});`)?.value);

    // Ключ — это имя буквально, а не значение переменной с тем же именем.
    assert.strictEqual('{"k":1}', executeReturnCode(`var k = "dyn"; return JSON.stringify({k:1});`)?.value);

    // Объект как аргумент функции и как ветка тернарного оператора.
    assert.strictEqual(42, executeReturnCode(`function f(o){ return o.x; } return f({x:42});`)?.value);
    assert.strictEqual('{"a":1}', executeReturnCode(`return JSON.stringify(true ? {a:1} : {b:2});`)?.value);
});

test('092_MapOpsTypeofIsEmpty', () => {
    const rc = (s: string) => executeReturnCode(s)?.value;

    // Object: removeKey/pick/omit/merge — новый объект, вход не меняется.
    assert.strictEqual('{"a":1,"c":3}', rc(`return JSON.stringify(Object.removeKey({a:1,b:2,c:3}, "b"));`));
    assert.strictEqual('{"a":1,"c":3}', rc(`return JSON.stringify(Object.pick({a:1,b:2,c:3}, ["a","c","zzz"]));`));
    assert.strictEqual('{"a":1}', rc(`return JSON.stringify(Object.omit({a:1,b:2,c:3}, ["b","c"]));`));
    assert.strictEqual('{"a":1,"b":3,"c":4}', rc(`return JSON.stringify(Object.merge({a:1,b:2}, {b:3,c:4}));`));
    assert.strictEqual('{"a":{"x":1,"y":9,"z":3}}', rc(`return JSON.stringify(Object.merge({a:{x:1,y:2}}, {a:{y:9,z:3}}));`));
    assert.strictEqual('{"a":1,"b":2}|{"b":2}', rc(`var o={a:1,b:2}; var r=Object.removeKey(o,"a"); return JSON.stringify(o)+"|"+JSON.stringify(r);`));

    // typeof — JS-семантика (null/массив/объект → "object", "boolean" а не "bool").
    assert.strictEqual('number', rc(`return typeof 5;`));
    assert.strictEqual('string', rc(`return typeof "x";`));
    assert.strictEqual('boolean', rc(`return typeof true;`));
    assert.strictEqual('object', rc(`return typeof null;`));
    assert.strictEqual('object', rc(`return typeof [1,2];`));
    assert.strictEqual('object', rc(`return typeof {a:1};`));
    assert.strictEqual('object', rc(`let x; return typeof x;`)); // отсутствие — null, его typeof — "object"
    assert.strictEqual('number!', rc(`return typeof 1 + "!";`)); //приоритет: (typeof 1) + "!"

    // Object.isEmpty
    assert.strictEqual(true, rc(`return Object.isEmpty("");`));
    assert.strictEqual(true, rc(`return Object.isEmpty([]);`));
    assert.strictEqual(true, rc(`return Object.isEmpty({});`));
    assert.strictEqual(true, rc(`return Object.isEmpty(null);`));
    assert.strictEqual(false, rc(`return Object.isEmpty(0);`));
    assert.strictEqual(false, rc(`return Object.isEmpty({a:1});`));
});

test('093_NumberFormatEncoding', () => {
    const rc = (s: string) => executeReturnCode(s)?.value;

    // Number.roundTo — число; сверяем строкой/сравнением (без int/float-ловушки).
    assert.strictEqual(true, rc(`return Number.roundTo(3.14159, 2) == 3.14;`));
    assert.strictEqual('1', rc(`return (Number.roundTo(1.005, 2)).toString();`));
    assert.strictEqual('-3', rc(`return (Number.roundTo(-2.5, 0)).toString();`));
    assert.strictEqual('0', rc(`return (Number.roundTo(-0.001, 2)).toString();`));

    // Number.format — строка с группировкой; разделители явные.
    assert.strictEqual('1,234,567.89', rc(`return Number.format(1234567.891, 2);`));
    assert.strictEqual('1 234 567,89', rc(`return Number.format(1234567.891, 2, ",", " ");`));
    assert.strictEqual('-1,235', rc(`return Number.format(-1234.5, 0);`));
    assert.strictEqual('0', rc(`return Number.format(-0.4, 0);`));

    // Base64 — значения hex/base64 ASCII, и round-trip UTF-8.
    assert.strictEqual('SGVsbG8sIFdvcmxkIQ==', rc(`return Base64.encode("Hello, World!");`));
    assert.strictEqual('Hello, World!', rc(`return Base64.decode("SGVsbG8sIFdvcmxkIQ==");`));
    assert.strictEqual('привет', rc(`return Base64.decode(Base64.encode("привет"));`));

    // Url — encodeURIComponent-семантика.
    assert.strictEqual('a%20b%26c%3D%D0%B4', rc(`return Url.encode("a b&c=д");`));
    assert.strictEqual('a b&c=д', rc(`return Url.decode("a%20b%26c%3D%D0%B4");`));
    assert.strictEqual("a-_.!~*'()", rc(`return Url.encode("a-_.!~*'()");`));
});

test('094_HashDate', () => {
    const rc = (s: string) => executeReturnCode(s)?.value;

    // Hash — канонические значения.
    assert.strictEqual('900150983cd24fb0d6963f7d28e17f72', rc(`return Hash.md5("abc");`));
    assert.strictEqual('608333adc72f545078ede3aad71bfe74', rc(`return Hash.md5("привет");`));
    assert.strictEqual('a9993e364706816aba3e25717850c26c9cd0d89d', rc(`return Hash.sha1("abc");`));
    assert.strictEqual('da39a3ee5e6b4b0d3255bfef95601890afd80709', rc(`return Hash.sha1("");`));
    assert.strictEqual(true, rc(`return Hash.crc32("abc") == 891568578;`));

    // DateTime.fromTimestamp / format / parse (UTC по умолчанию).
    assert.strictEqual('1970-01-01 00:00:00', rc(`return DateTime.fromTimestamp(0).format("YYYY-MM-DD HH:mm:ss");`));
    assert.strictEqual('2023-11-14 22:13:20', rc(`return DateTime.fromTimestamp(1700000000).format("YYYY-MM-DD HH:mm:ss");`));
    assert.strictEqual('14.11.2023', rc(`return DateTime.fromTimestamp(1700000000).format("DD.MM.YYYY");`));
    assert.strictEqual(true, rc(`return DateTime.parse("2023-11-14 22:13:20", "YYYY-MM-DD HH:mm:ss") == DateTime.fromTimestamp(1700000000);`));
    assert.strictEqual('2024/03/14', rc(`return DateTime.parse("14.03.2024", "DD.MM.YYYY").format("YYYY/MM/DD");`));
    assert.strictEqual('2020-02-29', rc(`return DateTime.parse("2020-02-29", "YYYY-MM-DD").format("YYYY-MM-DD");`));
});

test('095_ArrayUnique', () => {
    // unique() — новый массив без повторов, первое вхождение сохраняется, порядок не меняется.
    assert.strictEqual('[1,2,3,4]', executeReturnCode(`return JSON.stringify([1,2,2,3,1,4].unique());`)?.value);
    assert.strictEqual('["a","b","c"]', executeReturnCode(`return JSON.stringify(["a","b","a","c","b"].unique());`)?.value);
    // сравнение строгое по типу: число 1 и строка "1" — разные значения.
    assert.strictEqual('[1,"1"]', executeReturnCode(`return JSON.stringify([1,"1",1].unique());`)?.value);
    // исходный массив не меняется.
    assert.strictEqual('[1,1,2]#[1,2]', executeReturnCode(`let a=[1,1,2]; let u=a.unique(); return JSON.stringify(a) + "#" + JSON.stringify(u);`)?.value);
    // пустой массив.
    assert.strictEqual('[]', executeReturnCode(`return JSON.stringify([].unique());`)?.value);
});
test('096_ArrowBasics', () => {
    const rc = (s: string) => executeReturnCode(s)?.value;

    // Один параметр без скобок; тело-выражение — неявный return.
    assert.strictEqual('42', rc(`let f = x => x * 2; return (f(21)).toString();`));
    // Список параметров в скобках.
    assert.strictEqual('42', rc(`let f = (a, b) => a + b; return (f(40, 2)).toString();`));
    // Без параметров.
    assert.strictEqual('42', rc(`let f = () => 42; return (f()).toString();`));
    // Один параметр в скобках.
    assert.strictEqual('42', rc(`let f = (x) => x + 1; return (f(41)).toString();`));
    // Тело-блок с явным return.
    assert.strictEqual('42', rc(`let f = (a) => { let t = a * 2; return t + 2; }; return (f(20)).toString();`));
    // Тело-блок без return — результат null.
    assert.strictEqual(true, rc(`let f = (a) => { let t = a; }; return f(1) == null;`));
    // Параметр со значением по умолчанию и rest-параметр.
    assert.strictEqual('42', rc(`let f = (a, b = 2) => a + b; return (f(40)).toString();`));
    assert.strictEqual('3', rc(`let f = (...xs) => xs.length; return (f(1, 2, 3)).toString();`));
    // typeof стрелки — function; const-объявление тоже работает.
    assert.strictEqual('function', rc(`let f = x => x; return typeof f;`));
    assert.strictEqual('42', rc(`const f = x => x + 1; return (f(41)).toString();`));
    // Литерал объекта в теле-выражении пишется в скобках (как в JS).
    assert.strictEqual('7', rc(`let f = x => ({v: x}); let o = f(7); return (o.v).toString();`));
    // Стрелка в объектном литерале.
    assert.strictEqual('42', rc(`let o = {inc: x => x + 1}; let g = o.inc; return (g(41)).toString();`));
});

test('096_ArrowCallbacks', () => {
    const rc = (s: string) => executeReturnCode(s)?.value;

    // Тело стрелки-аргумента тянется до запятой — второй аргумент не съедается.
    assert.strictEqual('42', rc(`function ap(fn, v) { return fn(v); } return (ap(x => x + 1, 41)).toString();`));
    // Массивные методы высшего порядка.
    assert.strictEqual('[10,20,30]', rc(`return JSON.stringify([1,2,3].map(v => v * 10));`));
    assert.strictEqual('[1,3]', rc(`return JSON.stringify([1,2,3,4].filter(x => x % 2 == 1));`));
    assert.strictEqual('16', rc(`return ([1,2,3].reduce((acc, v) => acc + v, 10)).toString();`));
    assert.strictEqual('[1,3,5,8]', rc(`return JSON.stringify([5,3,8,1].sort((a, b) => a - b));`));
    assert.strictEqual('3', rc(`return ([2,4,3,6].find(x => x % 2 == 1)).toString();`));
});

test('096_ArrowLexicalThis', () => {
    const rc = (s: string) => executeReturnCode(s)?.value;

    // this внутри стрелки — из окружающего метода (лексический).
    assert.strictEqual(
        '11:12',
        rc(`class A { constructor() { this.x = 10; } run() { let r = [1,2].map(v => v + this.x); return r[0].toString() + ":" + r[1].toString(); } } return new A().run();`),
    );
    // Тело-блок видит this так же.
    assert.strictEqual('42', rc(`class T { constructor() { this.n = 2; } m() { let f = () => { return this.n * 21; }; return f(); } } let t = new T(); return (t.m()).toString();`));
    // Динамический this игнорируется: стрелка, созданная в методе B,
    // держит this экземпляра B даже при вызове как свойство другого объекта.
    assert.strictEqual(
        '5',
        rc(`class B { constructor() { this.x = 5; } mk() { return () => this.x; } } class C { constructor() { this.x = 99; } } let b = new B(); let c = new C(); c.g = b.mk(); return (c.g()).toString();`),
    );
    // Стрелка, созданная вне метода, this не имеет — та же ошибка, что вне метода.
    assert.strictEqual(
        true,
        rc(`let f = v => this; let r = "no-err"; try { f(1); } catch (e) { r = e.message; } return r.indexOf("is not available") >= 0;`),
    );
});

test('096_ArrowClosures', () => {
    const rc = (s: string) => executeReturnCode(s)?.value;

    // Замыкание: стрелка видит переменные места создания.
    assert.strictEqual('42', rc(`function make(n) { return x => x + n; } let add5 = make(5); return (add5(37)).toString();`));
    // Каррирование: стрелка возвращает стрелку.
    assert.strictEqual('42', rc(`let f = a => b => a + b; let g = f(40); return (g(2)).toString();`));
    // Транзитивный захват: третий уровень видит переменную «деда»
    // (снимок замыкания сливается с захватом объемлющей функции).
    assert.strictEqual('6', rc(`let f = a => b => c => a + b + c; let g1 = f(1); let g2 = g1(2); return (g2(3)).toString();`));
    assert.strictEqual('6', rc(`let f = function(a) { return function(b) { return function(c) { return a + b + c; }; }; }; let g1 = f(1); let g2 = g1(2); return (g2(3)).toString();`));
    // Тело-блок меняет внешнюю переменную.
    assert.strictEqual('2', rc(`let n = 0; let f = () => { n = n + 1; return n; }; f(); f(); return (n).toString();`));
});

test('096_ArrowArrayKeys', () => {
    const rc = (s: string) => executeReturnCode(s)?.value;

    // Внутри литерала массива `=>` остаётся разделителем ключа:
    // голый идентификатор слева — динамический ключ, а не стрелка.
    assert.strictEqual('300', rc(`let x = 'k'; let a = [x => 100, 'kk' => 200]; return ((a['k'] + a['kk'])).toString();`));
    // Скобки слева от `=>` в массиве — тоже ключ (живое поведение).
    assert.strictEqual('1', rc(`return ([('k') => 1]['k']).toString();`));
    // Стрелка внутри массива пишется в скобках.
    assert.strictEqual('42', rc(`let a = [(x => x * 2), 3]; let g = a[0]; return (g(21)).toString();`));
    // Стрелка как значение ассоциативного ключа — в скобках.
    assert.strictEqual('42', rc(`let a = ['fn' => (x => x + 1)]; let g = a['fn']; return (g(41)).toString();`));
    // Скобочное подвыражение как значение ассоциативного ключа.
    assert.strictEqual('3', rc(`return (['k' => (1 + 2)]['k']).toString();`));
});

test('096_ArrowNewThrows', () => {
    // Стрелка — не конструктор (как в JS). Сообщение проверяем вхождением:
    // префикс [строка:столбец] у ошибок new-времени в движках различается
    // (PHP InterpreterNode не несёт позицию токена).
    const message = String(executeReturnCode(`let f = x => x; let r = ""; try { let o = new f(1); } catch (e) { r = e.message; } return r;`)?.value);
    assert.ok(message.indexOf('"f" is not a constructor') >= 0, message);
});

test('096_ArrowParseErrors', () => {
    // `=>` после выражения (не одиночного идентификатора в начале) — ошибка разбора.
    assert.throws(() => {
        executeReturnCode('return 1 + x => 2;');
    }, /ltArraySeparator/);
    // Пустое тело-выражение — ошибка разбора.
    assert.throws(() => {
        executeReturnCode('let f = x => ;');
    }, /Parse expression failed/);
    // Обрыв текста сразу после `=>` — та же ошибка, без внутренних падений.
    assert.throws(() => {
        executeReturnCode('let f = x =>');
    }, /Parse expression failed/);
    // Заглядывание вперёд у `(` не сдвигает позицию ошибки: незакрытая
    // скобка и пустые скобки указывают на исходный токен.
    assert.throws(() => {
        executeReturnCode('let x = (1 + 2;\nreturn x;');
    }, /\[1:9\] Parse lexer expression failed, found token ltSemicolon expected ltRPar/);
    assert.throws(() => {
        executeReturnCode('x = ();');
    }, /\[1:5\] Parse expression failed/);
});

test('096_FunctionValueByReference', () => {
    const rc = (s: string) => executeReturnCode(s)?.value;

    // Сопутствующий багфикс: значение-функция в let/var/const хранится по ссылке
    // (раньше let-инициализация заворачивала её в хост-обёртку и вызов падал).
    assert.strictEqual('42', rc(`let f = function(x) { return x * 2; }; return (f(21)).toString();`));
    assert.strictEqual('42', rc(`var f = function(x) { return x * 2; }; return (f(21)).toString();`));
    // Функция, переданная аргументом, остаётся вызываемой.
    assert.strictEqual('42', rc(`function ap(fn, v) { return fn(v); } return ap(function(x) { return x + 1; }, 41).toString();`));
    // Присвоение функции другой переменной — та же функция.
    assert.strictEqual('42', rc(`let f = (a) => a; let g = f; return (g(42)).toString();`));
});

// Ошибка, которую бросил скрипт (или null, если не бросил) — для проверок кода и места.
function errorOf(text: string, prepare?: (context: ContextInterpreter) => void): MSLangException | null {
    try {
        const context = createCodeContext(text);
        prepare?.(context);
        context.exec(true);
    } catch (e) {
        if (e instanceof MSLangException) return e;
        throw e;
    }
    return null;
}

test('097_ErrorCodes', () => {
    const codeAt = (text: string, prepare?: (context: ContextInterpreter) => void) => {
        const e = errorOf(text, prepare);
        return e ? [e.getErrorCode(), e.getSourceLine(), e.getSourceColumn()] : null;
    };

    // Ошибка разбора — ParseError с местом.
    assert.deepStrictEqual(codeAt('let a = 1;\nreturn a +;'), ['ParseError', 2, 10]);
    // Неизвестная переменная, функция, метод, класс — UnknownName.
    assert.deepStrictEqual(codeAt('let a = 1;\nreturn b;'), ['UnknownName', 2, 8]);
    assert.strictEqual(codeAt('return foo(1);')?.[0], 'UnknownName');
    assert.strictEqual(codeAt('let s = "x"; return s.nope();')?.[0], 'UnknownName');
    assert.strictEqual(codeAt('return new Nope();')?.[0], 'UnknownName');
    // Вызов не-функции — NotCallable (тот же тип и текст, что в PHP).
    const notCallable = errorOf('let x = 1; return x(2);');
    assert.strictEqual(notCallable?.getErrorCode(), 'NotCallable');
    assert.strictEqual(notCallable?.getRawMessage(), 'Call global function x');
    assert.strictEqual(codeAt('let f = x => x; return new f(1);')?.[0], 'NotCallable');
    // Непойманный throw — Thrown.
    assert.strictEqual(codeAt('throw new Error("boom");')?.[0], 'Thrown');
    // Лимит шагов — StepLimit.
    assert.strictEqual(codeAt('let i = 0; while (true) { i++; }', (c) => c.setLimitExecInstruction(50))?.[0], 'StepLimit');
    // Ошибка из служебного узла несёт место исходного токена (раньше в PHP его не было).
    assert.deepStrictEqual(codeAt('let f = x => x;\nlet o = new f(1);'), ['NotCallable', 2, 13]);
    // Сообщение без приставки и сводка одним объектом.
    const e = errorOf('return y;');
    assert.strictEqual(e?.message, '[1:8] variable not defined y');
    assert.deepStrictEqual(e?.toArray(), {code: 'UnknownName', message: 'variable not defined y', line: 1, column: 8, endLine: 1, endColumn: 8});
    // Скриптовый catch видит код в e.code.
    assert.strictEqual(executeReturnCode('try { return y; } catch (e) { return e.code; }')?.value, 'UnknownName');
});

test('098_StrictOperators', () => {
    // `==` без приведения, порядок — только числа и даты, арифметика — только
    // числа (и `+` для двух строк). Всё остальное — TypeMismatch.
    assert.strictEqual('num', executeReturnCode('switch (1) { case "1": return "str"; case 1: return "num"; } return "none";')?.value, 'switch (1) { case "1": return "str"; case 1: return "num"; } return "none";');
    assert.strictEqual(true, executeReturnCode('let a = [1]; let b = a; return a == b;')?.value, 'let a = [1]; let b = a; return a == b;');
    assert.strictEqual(false, executeReturnCode('return [1] == [1];')?.value, 'return [1] == [1];');
    assert.strictEqual(true, executeReturnCode('return DateTime.fromTimestamp(10) < DateTime.fromTimestamp(20);')?.value, 'return DateTime.fromTimestamp(10) < DateTime.fromTimestamp(20);');
    assert.strictEqual(true, executeReturnCode('return DateTime.fromTimestamp(10) == DateTime.fromTimestamp(10);')?.value, 'return DateTime.fromTimestamp(10) == DateTime.fromTimestamp(10);');
    assert.strictEqual(false, executeReturnCode('return (0/0) == (0/0);')?.value, 'return (0/0) == (0/0);');
    assert.strictEqual(11, executeReturnCode('let n = 7; n %= 2; n += 10; return n;')?.value, 'let n = 7; n %= 2; n += 10; return n;');
    assert.strictEqual(3, executeReturnCode('return 7 & 3;')?.value, 'return 7 & 3;');
    for (const script of ['return "a" < "b";', 'return null > 0;', 'return true >= false;', 'return DateTime.Now > 0;', 'return "x" * 2;', 'return -"1";', 'return 1 << "1";', 'let s = "a"; s -= "b"; return s;', 'let x = "1"; x++; return x;']) {
        assert.strictEqual('TypeMismatch', errorOf(script)?.getErrorCode(), script);
    }
    assert.strictEqual('Operator + is not defined for string and number', errorOf('return "a" + 1;')?.getRawMessage());
    assert.strictEqual('Operator < is not defined for null and number', errorOf('return null < 1;')?.getRawMessage());
    assert.strictEqual('Operator -- is not defined for bool', errorOf('let x = true; x--; return x;')?.getRawMessage());
});

test('099_AbsenceIsNull', () => {
    // Одно значение отсутствия — null: неинициализированная переменная, нет
    // свойства или индекса, путь через отсутствующее звено, функция без return.
    for (const script of ['let x; return x;', 'let o = {a: 1}; return o.b;', 'let o = {a: 1}; return o.b.c;', 'let o = null; return o.a.b;', 'let a = [1]; return a[5];', 'return "ab"[5];', 'function f() { } return f();', 'function f() { return; } return f();', 'let f = x => { let t = x; }; return f(1);', 'return [1, 2].forEach(x => x);', 'return [1, 2].find(x => x > 5);', 'return JSON.parse("{oops");', 'return Env.nope;', 'return new Array(2)[0];', 'function f() { return x; var x = 1; } return f();']) {
        assert.strictEqual(VariableType.vtNull, (executeReturnCode(script) as StackVariable).type, script);
    }
    // Литерала undefined больше нет — это неизвестное имя.
    assert.strictEqual('UnknownName', errorOf('return undefined;')?.getErrorCode());
    // Голое неизвестное имя — ошибка, а путь от известного корня — null.
    assert.strictEqual('UnknownName', errorOf('return nope.a;')?.getErrorCode());
    // Object.get / Object.has: null — то же отсутствие.
    assert.strictEqual('d', executeReturnCode('return Object.get({a: null}, "a", "d");')?.value);
    assert.strictEqual(false, executeReturnCode('return Object.has({a: null}, "a");')?.value);
    assert.strictEqual(true, executeReturnCode('return Object.has({a: 0}, "a");')?.value);
});

test('100_Length', () => {
    // `.length` у строки — число символов (код-поинтов), у списка — число элементов.
    // Раньше PHP считал у строки байты UTF-8, TS — единицы UTF-16.
    assert.strictEqual(3, executeReturnCode('return "абв".length;')?.value, 'return "абв".length;');
    assert.strictEqual(2, executeReturnCode('return "😀a".length;')?.value, 'return "😀a".length;');
    assert.strictEqual(2, executeReturnCode('return "😀a".Length();')?.value, 'return "😀a".Length();');
    assert.strictEqual(0, executeReturnCode('return "".length;')?.value, 'return "".length;');
    assert.strictEqual(3, executeReturnCode('return [1, 2, 3].length;')?.value, 'return [1, 2, 3].length;');
    assert.strictEqual(0, executeReturnCode('return [].length;')?.value, 'return [].length;');
    assert.strictEqual('аб', executeReturnCode('let s = "абв"; return s.slice(0, s.length - 1);')?.value, 'let s = "абв"; return s.slice(0, s.length - 1);');
    // У значений без длины — null (свойства нет), а не ошибка.
    assert.strictEqual(VariableType.vtNull, (executeReturnCode('return {a: 1}.length;') as StackVariable).type);
});

test('101_PresenceCheck', () => {
    // `??` — правое значение только для null; `?.` — безопасное обращение (null слева —
    // обращение пропускается вместе с аргументами); `exists(x)` — есть ли значение.
    assert.strictEqual(1, executeReturnCode('return null ?? 1;')?.value, 'return null ?? 1;');
    assert.strictEqual(0, executeReturnCode('return 0 ?? 1;')?.value, 'return 0 ?? 1;');
    assert.strictEqual(false, executeReturnCode('return false ?? true;')?.value, 'return false ?? true;');
    assert.strictEqual('', executeReturnCode('return "" ?? "x";')?.value, 'return "" ?? "x";');
    assert.strictEqual('def', executeReturnCode('let o = {a: null}; return o.a ?? "def";')?.value, 'let o = {a: null}; return o.a ?? "def";');
    assert.strictEqual(3, executeReturnCode('return null ?? null ?? 3;')?.value, 'return null ?? null ?? 3;');
    assert.strictEqual(0, executeReturnCode('let c = 0; function hit() { c = c + 1; return 5; } let r = 1 ?? hit(); return c;')?.value, 'let c = 0; function hit() { c = c + 1; return 5; } let r = 1 ?? hit(); return c;');
    assert.strictEqual(3, executeReturnCode('return 1 + 2 ?? 5;')?.value, 'return 1 + 2 ?? 5;');
    assert.strictEqual(true, executeReturnCode('return true || false ?? 1;')?.value, 'return true || false ?? 1;');
    assert.strictEqual(7, executeReturnCode('let a = {b: {c: 7}}; return a?.b?.c;')?.value, 'let a = {b: {c: 7}}; return a?.b?.c;');
    assert.strictEqual(6, executeReturnCode('let a = [5, 6]; return a?.[1];')?.value, 'let a = [5, 6]; return a?.[1];');
    assert.strictEqual('none', executeReturnCode('let a = null; return a?.[0] ?? "none";')?.value, 'let a = null; return a?.[0] ?? "none";');
    assert.strictEqual('ABC', executeReturnCode('let s = "abc"; return s?.ToUpper();')?.value, 'let s = "abc"; return s?.ToUpper();');
    assert.strictEqual(0, executeReturnCode('let a = null; let c = 0; function hit() { c = c + 1; return 1; } let r = a?.m(hit()); return c;')?.value, 'let a = null; let c = 0; function hit() { c = c + 1; return 1; } let r = a?.m(hit()); return c;');
    assert.strictEqual(1, executeReturnCode('return true?1:2;')?.value, 'return true?1:2;');
    assert.strictEqual(false, executeReturnCode('return exists(nope);')?.value, 'return exists(nope);');
    assert.strictEqual(false, executeReturnCode('let x = null; return exists(x);')?.value, 'let x = null; return exists(x);');
    assert.strictEqual(true, executeReturnCode('let x = 0; return exists(x);')?.value, 'let x = 0; return exists(x);');
    assert.strictEqual(false, executeReturnCode('let o = {a: {}}; return exists(o.a.b);')?.value, 'let o = {a: {}}; return exists(o.a.b);');
    assert.strictEqual(true, executeReturnCode('return !exists(nope) && exists(1 + 1);')?.value, 'return !exists(nope) && exists(1 + 1);');
    assert.strictEqual(1, executeReturnCode('let o = {exists: 1}; return o.exists;')?.value, 'let o = {exists: 1}; return o.exists;');
    for (const script of ['let a = null; return a?.b;', 'let a = null; return a?.b.c;', 'let a = null; return a?.[0];', 'let a = null; return a?.m(1);']) {
        assert.strictEqual(VariableType.vtNull, (executeReturnCode(script) as StackVariable).type, script);
    }
    assert.strictEqual('ParseError', errorOf('let a = null; a?.b = 1;')?.getErrorCode(), 'let a = null; a?.b = 1;');
    assert.strictEqual('ParseError', errorOf('return exists 5;')?.getErrorCode(), 'return exists 5;');
    assert.strictEqual('ParseError', errorOf('return ?? 1;')?.getErrorCode(), 'return ?? 1;');
    assert.strictEqual('UnknownName', errorOf('return exists(nope.a);')?.getErrorCode(), 'return exists(nope.a);');
});

test('102_ParseExpressionProgram', () => {
    const value = (p: ParsedScript) => (p.createContext().exec(true) as StackVariable).value;

    // Слово return внутри строки не делает выражение программой.
    let p = Script.parse('"return" + "x"');
    assert.strictEqual('expression', p.getKind());
    assert.strictEqual('returnx', value(p));

    // Программа с return — программа.
    p = Script.parse('let a = 2; return a * 3;');
    assert.strictEqual('program', p.getKind());
    assert.strictEqual(6, value(p));

    // `{a: 1}` в выражении — литерал объекта, а не блок.
    assert.strictEqual('{"a":1}', value(Script.parseExpression('JSON.stringify({a: 1})')));

    // parseExpression: инструкции — ошибка разбора с местом.
    assert.throws(() => Script.parseExpression('a; b'),
        (e: unknown) => e instanceof MSLangException && e.getErrorCode() === 'ParseError' && e.getSourceLine() === 1 && e.getSourceColumn() === 2);

    // parse: если не годится ни выражение, ни программа, — ошибка того разбора, что ушёл дальше.
    assert.throws(() => Script.parse('1 +'),
        (e: unknown) => e instanceof MSLangException && e.getErrorCode() === 'ParseError' && e.getSourceLine() === 1 && e.getSourceColumn() === 3);

    // Один разбор — много исполнений с разными значениями.
    const expr = Script.parseExpression('a * 2');
    const results = [1, 2, 3].map((a) => {
        const context = expr.createContext();
        context.setVariable('a', new StackVariableNumber(false, a));
        return (context.exec(true) as StackVariable).value;
    });
    assert.deepStrictEqual([2, 4, 6], results);

    // Программа без `;` в конце разбирается (раньше TS падал на конце текста).
    assert.strictEqual('program', Script.parseProgram('x = 5').getKind());
});

test('103_RegisterFunction', () => {
    const context = createCodeContext('return [k, z, Math];');
    const isCode = (code: string, message?: string) => (e: unknown) =>
        e instanceof MSLangException && e.getErrorCode() === code && (message === undefined || e.getRawMessage() === message);

    context.registerFunction('k', new StackVariableNumber(false, 1));

    // Повтор без разрешения на замену — DuplicateName с именем; прежнее значение не тронуто.
    assert.throws(() => context.registerFunction('k', new StackVariableNumber(false, 2)),
        isCode('DuplicateName', 'Name "k" is already registered'));
    // Встроенное имя тоже защищено.
    assert.throws(() => context.registerFunction('Math', new StackVariableNumber(false, 0)), isCode('DuplicateName'));

    // Ошибка одной регистрации не мешает следующим; явная замена — флагом.
    context.registerFunction('z', new StackVariableNumber(false, 3));
    context.registerFunction('k', new StackVariableNumber(false, 2), true);
    context.registerFunction('Math', new StackVariableNumber(false, 9), true);

    assert.deepStrictEqual([2, 3, 9], (context.exec(true) as StackVariableArray).convertToNativeArray());
});

test('104_Ast', () => {
    // Публичный AST сверяется с общими фикстурами tests/ast/*.msl + *.json (те же файлы
    // проверяет PHP-эталон — JSON двух движков совпадает, включая места `loc`).
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ast');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.msl')).sort();
    assert.ok(files.length > 0, 'Нет фикстур AST в ' + dir);

    for (const file of files) {
        const expected = JSON.parse(fs.readFileSync(path.join(dir, file.replace(/\.msl$/, '.json')), 'utf-8'));
        const actual = JSON.parse(JSON.stringify(Script.parse(fs.readFileSync(path.join(dir, file), 'utf-8')).toAst()));
        assert.deepStrictEqual(actual, expected, file);
    }

    // Выражение — корень Expression, программа — Program; версия формата — 1.
    const root = Script.parseExpression('1').toAst();
    assert.deepStrictEqual(['Expression', 1], [root.type, root.version]);
    assert.strictEqual('Program', Script.parseProgram('return 1;').toAst().type);
});

test('111_ConditionAsExpression', () => {
    // Условие if/while — обычное выражение: те же приоритеты, что вне условия. Раньше
    // скобки слева от сравнения считались вложенным условием и требовали boolean.
    const cases: [string, unknown][] = [
        ['let n = 1; if ((n + 1) == 2) return "T"; return "F";', 'T'],
        ['let s = "a"; if ((s) == "a") return "T"; return "F";', 'T'],
        ['let n = null; let i = 0; while ((n ?? 0) + i < 3) { i++; } return i;', 3],
        ['let x = null; if (x == null ?? false) return "T"; return "F";', 'T'],
        ['let x = 1; if (x == 1 ? true : false) return "T"; return "F";', 'T'],
        ['let x = null; if ((x) ?? true) return "T"; return "F";', 'T'],
        ['if ((1) + 1 > 0) return "T"; return "F";', 'T'],
    ];
    for (const [script, expected] of cases) {
        assert.strictEqual(expected, executeReturnCode(script)?.value, script);
    }
    assert.strictEqual('Expected boolean in if, got number', errorOf('if (1) return 1;')?.getRawMessage());
    assert.strictEqual('Expected boolean in loop condition, got number', errorOf('let i = 0; while (i) { i++; }')?.getRawMessage());
});

test('112_ScriptParseNameAtEnd', () => {
    // Имя в самом конце текста — граница имени, а не ошибка лексера: формулы `a`,
    // `price > 100`, `x.y` разбираются.
    for (const source of ['a', 'price > 100', 'a + b', 'true', 'x.y', '[1, 2].length', 'a?.b']) {
        assert.strictEqual('expression', Script.parse(source).getKind(), source);
    }
    const context = Script.parseExpression('price > 100').createContext();
    context.setVariable('price', new StackVariableNumber(false, 150));
    assert.strictEqual(true, context.exec(true)?.value);
});

test('113_OptionalChainIsReadOnly', () => {
    // `?.` только читает: любая запись через цепочку с `?.` — ошибка разбора.
    for (const script of ['a?.b = 1;', 'a?.[0] = 1;', 'a?.b++;', '++a?.b;', 'a?.b.c = 5;', 'a?.b[0] = 5;']) {
        assert.strictEqual('ParseError', errorOf('let a = {b: {c: 1}}; ' + script)?.getErrorCode(), script);
    }
    assert.strictEqual(5, executeReturnCode('let a = {b: {c: 1}}; a.b.c = 5; return a?.b.c;')?.value);
});

test('114_DotNumberExistsParensOwnNames', () => {
    // `.5` в позиции операнда — число (было «Stack is empty»).
    assert.strictEqual(0.5, executeReturnCode('let x = true; return x ?.5 : 1;')?.value);
    assert.strictEqual(1.25, executeReturnCode('return 1 + .25;')?.value);
    // Скобки вокруг имени в exists ничего не меняют.
    assert.strictEqual(false, executeReturnCode('return exists((nope));')?.value);
    // Служебные имена хост-языка (toString, constructor) — не переменные скрипта
    // (в TS таблица переменных — объект с прототипом Object).
    assert.strictEqual(false, executeReturnCode('return exists(toString);')?.value);
    assert.strictEqual('UnknownName', errorOf('return constructor;')?.getErrorCode());
    const context = createCodeContext('return toString;');
    context.registerFunction('toString', new StackVariableNumber(false, 7));
    assert.strictEqual(7, context.exec(true)?.value);
});

test('115_IncludesUniqueEquality', () => {
    // includes/unique сравнивают как `==` (valuesEqual): 1 и 1.0 равны, ссылки — по ссылке.
    assert.strictEqual(true, executeReturnCode('return [1].includes(0.5 * 2);')?.value);
    assert.deepStrictEqual([3], (executeReturnCode('return [1.5 * 2, 3].unique();') as StackVariableArray).convertToNativeArray());
    assert.strictEqual(false, executeReturnCode('return [[1]].includes([1]);')?.value);
    assert.strictEqual(false, executeReturnCode('return [(0/0)].includes(0/0);')?.value);
});

test('105_ScalarOffsetWrite', () => {
    // Запись по ключу — только в массив и объект-литерал; у скаляра, хост-объекта и даты —
    // «Cannot set offset» (TS раньше молча ничего не делал).
    for (const script of ['let n = 5; n[0] = 1;', 'let t = true; t[0] = 1;', 'let x = null; x[0] = 1;', 'let s = "abc"; s[0] = "x";', 'let d = DateTime.Now; d[0] = 1;']) {
        assert.strictEqual('Cannot set offset', errorOf(script)?.getRawMessage(), script);
    }
    assert.strictEqual(2, executeReturnCode('let a = [1]; a[0] = 2; return a[0];')?.value);
    assert.strictEqual(1, executeReturnCode('let o = {}; o["k"] = 1; return o.k;')?.value);
});

test('106_IndexOfEntryName', () => {
    // Имя FunctionEntry метода indexOf — «IndexOf», как у прочих методов (funcInvokeIndexOf);
    // раньше TS держал funcInvoke_indexOf и отдавал «indexOf».
    assert.strictEqual('IndexOf', new StackVariableString(false, 'abc').getFunctionEntry('indexOf')?.getName());
    assert.strictEqual('IndexOf', new StackVariableArray(false, []).getFunctionEntry('indexOf')?.getName());
    assert.strictEqual(2, executeReturnCode('return "hello".indexOf("l");')?.value);
});

test('107_ArrayKeysNumeric', () => {
    // keys(): целочисленный ключ — число, прочие — строка (как PHP array_keys); TS раньше
    // отдавал строки, и при строгом == выходило [10,20].keys()[1] == 1 → false.
    assert.deepStrictEqual([0, 1], (executeReturnCode('return [10, 20].keys();') as StackVariableArray).convertToNativeArray());
    assert.deepStrictEqual(['a', 5, '05', -2], (executeReturnCode('return ["a" => 1, 5 => 2, "05" => 3, -2 => 4].keys();') as StackVariableArray).convertToNativeArray());
    assert.strictEqual(true, executeReturnCode('return [10, 20].keys()[1] == 1;')?.value);
});

test('108_FunctionParameterDefaultType', () => {
    // Тип параметра без явного указания — null («любой»), как ?int $_type = null в эталоне.
    assert.strictEqual(null, new FunctionParameter('x').getType());
    // Значение по умолчанию без типа — понятная ошибка описания функции, а не сырой TypeError.
    const context = createCodeContext('return 1;');
    assert.throws(() => new FunctionParameter('x', null, false, false, 5).createVariableDefaultValue(context),
        (e: unknown) => e instanceof MSLangException && e.message === 'Parameter "x" has a default value but no type');
});

test('109_UnaryMinusAndNegativeZero', () => {
    // Унарный минус помечает парсер, а не угадывает интерпретатор по пустому стеку:
    // раньше `5 - -3` давало -2, а `5 * -3` и `5 * (-3)` падали.
    const cases: [string, number][] = [['return 5 - -3;', 8], ['return 5 * -3;', -15], ['return 5 * (-3);', -15], ['return 1 % -8;', 1],
        ['return 2 * -3 * -4;', 24], ['return 6 / -2 + 1;', -2], ['return 2 * - - 3;', 6], ['return 1 + +2;', 3]];
    for (const [script, expected] of cases) {
        assert.strictEqual(expected, executeReturnCode(script)?.value, script);
    }
    // Знак нуля по IEEE: целая арифметика PHP его теряла (1 / (0 * -1) давало Infinity).
    for (const script of ['return 1 / -(0);', 'return 1 / (0 * -1);', 'return 1 / (-7 % 1);', 'return 1 / (0 / -5);']) {
        assert.strictEqual(-Infinity, executeReturnCode(script)?.value, script);
    }
    assert.strictEqual(Infinity, executeReturnCode('return 1 / (3 - 3);')?.value);
});

test('110_ThrowInsideOperand', () => {
    // throw внутри операнда бинарного оператора: оператор прерывается, исполнение идёт
    // в catch (раньше обработчик оператора продолжал и снимал со стека мусор —
    // «End of execution code» у `t * f()`).
    const prefix = 'function f() { throw new Error("x"); } ';
    assert.strictEqual(5, executeReturnCode(prefix + 'let t = 1; try { t = t * f(); } catch (e) { t = 5; } return t;')?.value);
    assert.strictEqual(1, executeReturnCode(prefix + 'let t = 1; try { t = t + f(); } catch (e) { t = t + 0; } return t;')?.value);
    assert.strictEqual(5, executeReturnCode(prefix + 'let t = 1; try { t = t < f() ? 1 : 2; } catch (e) { t = 5; } return t;')?.value);
    assert.deepStrictEqual([9], (executeReturnCode(prefix + 'let r = []; try { r.push(2 * f()); } catch (e) { r.push(9); } return r;') as StackVariableArray).convertToNativeArray());
});

test('116_ElseIfAndSingleStatementBodies', () => {
    // Тело из одной инструкции `if (…) {…}` без else заглядывает вперёд за else — этот
    // токен больше не пропускается: инструкция после `else if (…) {…}` не теряется.
    const cases: [string, number][] = [
        ['let x = 5; if (x > 3) { x = 1; } else if (x == 5) { x = 2; } return x;', 1],
        ['let x = 1; if (x > 3) { return 1; } else if (x == 5) { return 2; } return 3;', 3],
        ['let x = 5; if (x > 9) { x = 1; } else if (x == 5) { x = 2; } else { x = 3; } return x;', 2],
        ['let x = 0; if (x > 9) x = 1; else if (x == 0) x = 2; return x;', 2],
        ['let r = 0; for (let i = 0; i < 3; i++) if (i == 1) { r = r + 10; } return r;', 10],
        ['let r = 0; let i = 0; while (i < 3) if (i++ == 1) { r = 5; } return r;', 5],
        ['let r = 0; for (const v of [1, 2]) if (v == 2) { r = v; } return r;', 2],
        ['let a = 1; if (a == 1) if (a == 2) { a = 9; } return a;', 1],
    ];
    for (const [script, expected] of cases) {
        assert.strictEqual(expected, executeReturnCode(script)?.value, script);
    }
});

test('117_ContinueInForWithDeclaration', () => {
    // continue в for с объявлением переменной (`let`/`var`) переходит на инкремент. В PHP
    // точка перехода была зашита числом и при `for (let i …)` пропускала инкремент —
    // цикл не кончался. Лимит шагов — чтобы зависание не повесило набор.
    const scripts: [string, number][] = [
        ['let s = 0; for (let i = 0; i < 5; i++) { if (i == 1) continue; s += i; } return s;', 9],
        ['let s = 0; for (var i = 0; i < 5; i++) { if (i == 1) continue; s += i; } return s;', 9],
        ['let s = 0; let i = 0; for (i = 0; i < 5; i++) { if (i == 1) continue; s += i; } return s;', 9],
        ['let s = 0; for (let i = 0; i < 5; i++) { s += i; continue; } return s;', 10],
    ];
    for (const [script, expected] of scripts) {
        const context = createCodeContext(script);
        context.setLimitExecInstruction(20000);
        assert.strictEqual(expected, context.exec(true)?.value, script);
    }
});

test('118_ContainersStoreValues', () => {
    // Массив и объект хранят ЗНАЧЕНИЕ скаляра, а не саму переменную: раньше переменная
    // цикла, изменённая «на месте», меняла и уже сохранённые элементы — [3,3,3].
    const cases: [string, unknown[]][] = [
        ['let r = []; for (let i = 0; i < 3; i++) r.push(i); return r;', [0, 1, 2]],
        ['let r = []; for (let i = 0; i < 3; i++) { r[i] = i; } return r;', [0, 1, 2]],
        ['let r = []; let i = 0; while (i < 3) { r.push(i); i = i + 1; } return r;', [0, 1, 2]],
        ['let r = []; for (let i = 0; i < 3; i++) r.unshift(i); return r;', [2, 1, 0]],
        ['let o = {}; for (let i = 0; i < 2; i++) { o["k" + i.toString()] = i; } return [o.k0, o.k1];', [0, 1]],
        ['function mk() { let c = 0; let r = []; return () => { r.push(c); c = c + 1; return r; }; } let g = mk(); g(); g(); return g();', [0, 1, 2]],
    ];
    for (const [script, expected] of cases) {
        assert.deepStrictEqual(expected, (executeReturnCode(script) as StackVariableArray).convertToNativeArray(), script);
    }
    // Массивы и объекты по-прежнему по ссылке.
    assert.deepStrictEqual([[1, 2]], (executeReturnCode('let a = [1]; let r = []; r.push(a); a.push(2); return r;') as StackVariableArray).convertToNativeArray());
});

test('119_StringEscapeWarnings', () => {
    // Подозрительные escape-последовательности дают предупреждение разбора с местом;
    // значение литерала не меняется.
    let parsed = Script.parse("let a = 1;\nreturn 'x\\ny';");
    assert.strictEqual(parsed.createContext().exec(true)?.value, 'x\\ny');
    assert.deepStrictEqual(parsed.getWarnings().map(w => ({code: w.code, line: w.line, column: w.column})),
        [{code: 'SuspiciousEscape', line: 2, column: 10}]);

    parsed = Script.parseExpression('"a\\qb"');
    assert.strictEqual(parsed.createContext().exec(true)?.value, 'a\\qb');
    assert.deepStrictEqual(parsed.getWarnings().map(w => w.code), ['UnknownEscape']);

    // Без предупреждений: известные последовательности и обычные строки.
    for (const source of ["'a\\'b'", "'a\\\\b'", '"a\\n\\t\\r\\\\\\"b"', "'plain'", "x ? 'a' : 'b'"]) {
        assert.deepStrictEqual(Script.parseExpression(source).getWarnings(), [], source);
    }
});

test('120_CallResultChaining', () => {
    // `(` после результата вызова, элемента или скобок вызывает полученное значение.
    const cases: [string, number][] = [
        ['let f = a => b => a + b; return f(40)(2);', 42],
        ['let f = a => b => c => a + b + c; return f(1)(2)(3);', 6],
        ['let f = a => b => a * b; return 1 + f(2)(3) * 2;', 13],
        ['let a = [(x => x + 1)]; return a[0](1);', 2],
        ['return (x => x * 3)(2);', 6],
        ['let o = {f: () => (n => n + 100)}; return o.f()(1);', 101],
    ];
    for (const [script, expected] of cases) {
        assert.strictEqual(executeReturnCode(script)?.value, expected, script);
    }

    assert.strictEqual('NotCallable', errorOf('let a = [1]; return a[0](1);')?.getErrorCode());
});

test('121_NewChainInBinaryExpression', () => {
    // `new T()` с хвостом обращений — целый операнд бинарного выражения. Раньше правый
    // операнд обрывался на служебном узле после конструктора: `1 + new T().v` давал
    // TypeMismatch «object and null».
    const cases: [string, unknown][] = [
        ['class T { m() { return "x"; } } return "" + new T().m();', 'x'],
        ['class T { constructor() { this.v = 2; } } return 1 + new T().v;', 3],
        ['class T { constructor() { this.v = 2; } } return 1 + new T().v * 3;', 7],
        ['class T { constructor() { this.v = [7]; } } return 1 + new T().v[0];', 8],
        ['class T { constructor() { this.v = 2; } } return new T().v == 2 && new T().v > 1;', true],
        ['class T { constructor(n) { this.v = n; } } return new T(1).v + new T(2).v;', 3],
    ];
    for (const [script, expected] of cases) {
        assert.strictEqual(executeReturnCode(script)?.value, expected, script);
    }
});

test('122_StatementStartsWithBracketOrNew', () => {
    // Инструкция может начинаться с литерала массива и с `new`; `{` в начале — по-прежнему блок.
    const cases: [string, unknown][] = [
        ['let r = []; [1,2,3].forEach(x => { r.push(x * 2); }); return r;', [2, 4, 6]],
        ['let s = 0; for (let i = 0; i < 2; i++) [10, 20].forEach(v => { s += v; }); return s;', 60],
        ['class T { constructor() { log.push(1); } } let log = []; new T(); return log;', [1]],
        ['let a = 1; { a = 2; } return a;', 2],
    ];
    for (const [script, expected] of cases) {
        const result = executeReturnCode(script);
        assert.deepStrictEqual(result instanceof StackVariableArray ? result.convertToNativeArray() : result?.value, expected, script);
    }
});

test('123_ArraySortComparator', () => {
    // sort(cmp): устойчивая сортировка слиянием, порядок вызовов cmp одинаков в обоих
    // движках. Без компаратора — прежняя сортировка по строковому виду.
    const cases: [string, unknown[]][] = [
        ['return [3,1,2].sort((a, b) => b - a);', [3, 2, 1]],
        ['return [10,9,1].sort((a, b) => a - b);', [1, 9, 10]],
        ['return [10,9,1].sort();', [1, 10, 9]],
        ['return [].sort((a, b) => a - b);', []],
        ['let a = [5,3,8,1]; a.sort((x, y) => x - y); return a;', [1, 3, 5, 8]],
        ['return [{k:1,n:"a"},{k:0,n:"b"},{k:1,n:"c"},{k:0,n:"d"}].sort((a, b) => a.k - b.k).map(o => o.n);', ['b', 'd', 'a', 'c']],
        ['let calls = []; [3,1,2,5,4].sort((a, b) => { calls.push([a, b]); return a - b; }); return calls;',
            [[3, 1], [2, 5], [1, 2], [3, 2], [3, 5], [1, 4], [2, 4], [3, 4], [5, 4]]],
    ];
    for (const [script, expected] of cases) {
        assert.deepStrictEqual((executeReturnCode(script) as StackVariableArray).convertToNativeArray(), expected, script);
    }
    assert.strictEqual('TypeMismatch', errorOf('return [1,2].sort((a, b) => "x");')?.getErrorCode());
});

test('124_IncrementDecrementTargets', () => {
    // Префикс/постфикс ++/-- определяет парсер; запись идёт в переменную, элемент массива
    // и свойство объекта. Раньше `++a[0];` исполнял остаток программы как свой операнд,
    // `a[0]++` не записывал результат, `2 * ++a[0]` ломался.
    const cases: [string, unknown[]][] = [
        ['let a = [0]; ++a[0]; return a;', [1]],
        ['let a = [0]; a[0]++; return a;', [1]],
        ['let o = {a: [5]}; ++o.a[0]; return o.a;', [6]],
        ['let a = [1]; return [2 * ++a[0], a[0]];', [4, 2]],
        ['let a = [1]; return [a[0]++ + 10, a[0]];', [11, 2]],
        ['let a = [5]; let x = a[0]; a[0]++; return [x, a[0]];', [5, 6]],
        ['let o = {k: 1}; let x = o.k; o.k++; ++o.k; return [x, o.k];', [1, 3]],
        ['let i = 0; let r = [i++, i++, ++i]; return [r, i];', [[0, 1, 3], 3]],
        ['let x = 0; let y = x++ + ++x; return [x, y];', [2, 2]],
        ['let i = 1; return [3 * ++i * 2, 2 * --i + 1];', [12, 3]],
    ];
    for (const [script, expected] of cases) {
        assert.deepStrictEqual((executeReturnCode(script) as StackVariableArray).convertToNativeArray(), expected, script);
    }
});

test('125_LexerTypeArrayShape', () => {
    // Форма LexerTypeArray одинакова в обоих движках: hasValue, one, cloneAdd без
    // изменения исходного набора, asNames, MSLangException на неизвестном типе.
    const base = LexerTypeArray.one(LexerType.ltSemicolon);
    const wide = base.cloneAdd([LexerType.ltComma, LexerType.ltRPar]);

    assert.ok(base.hasValue(LexerType.ltSemicolon));
    assert.ok(!base.hasValue(LexerType.ltComma));
    assert.ok(wide.hasValue(LexerType.ltRPar));
    assert.strictEqual(base.count(), 1);
    assert.deepStrictEqual(wide.asNames, ['ltSemicolon', 'ltComma', 'ltRPar']);

    assert.throws(() => new LexerTypeArray([9999]).asNames, MSLangException);
});

test('126_SharedBuiltinProperties', () => {
    // Свойства и методы встроенных типов одинаковы у каждого экземпляра (TS держит их
    // общими на всех — проверяем, что разные экземпляры не путаются).
    const cases: [string, unknown[]][] = [
        ['let a = "ab"; let b = "😀x"; return [a.length, b.length, "".length];', [2, 2, 0]],
        ['let a = [1]; let b = [1, 2, 3]; return [a.Count(), b.Count(), b.indexOf(3)];', [1, 3, 2]],
        ['return [(1.25).toFixed(1), (2).toFixed(2), "a-b".split("-").Count()];', ['1.3', '2.00', 2]],
    ];
    for (const [script, expected] of cases) {
        assert.deepStrictEqual((executeReturnCode(script) as StackVariableArray).convertToNativeArray(), expected, script);
    }
});

test('127_ReferenceDelegation', () => {
    // Переменная и свойство на стеке — ссылки: методы, свойства, switch, JSON и запись
    // через них работают как на самом значении (TS — явные делегаты, без Proxy).
    const cases: [string, unknown[]][] = [
        ['let a = [1]; a.push(2); return [a.Count(), a.join("-")];', [2, '1-2']],
        ['let s = "abc"; return [s.length, s.ToUpper()];', [3, 'ABC']],
        ['let o = {n: 1, t: "x"}; o.n++; return [o.n, o.t.length];', [2, 1]],
        ['let v = "b"; let r = ""; switch (v) { case "b": r = "B"; break; } return [r, JSON.stringify(v)];', ['B', '"b"']],
        ['class P { constructor() { let p = []; p.push(0); this.p = p; } } let a = new P(); let b = new P(); b.p.push(1); return [a.p.Count(), b.p.Count()];', [1, 2]],
    ];
    for (const [script, expected] of cases) {
        assert.deepStrictEqual((executeReturnCode(script) as StackVariableArray).convertToNativeArray(), expected, script);
    }
});
