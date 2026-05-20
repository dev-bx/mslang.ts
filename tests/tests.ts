import test from 'node:test';
import assert from 'node:assert/strict';
import {
    StackVariable, VariableType, StackVariableBoolean, StackVariableNumber, CodeLexer, CodeParser,
    LexerTypeArray, Interpreter, ContextInterpreter, LexerType, StackVariableArray, StackVariableString, ParseNode
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
    const returnVal = executeReturnCode('return "a"+"b"+(7*2)');

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

    returnVal = executeReturnCode('a = "a"; return a+1;');
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
        retVal = retVal+ar[i];
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
        
        return 'ok'+i;
    `);

    assert.strictEqual('ok11', returnVal?.value);

    returnVal = executeReturnCode(`
        return '10'-5;
    `);

    assert.strictEqual(5, returnVal?.value);

    returnVal = executeReturnCode(`
        a = -5;
        return +a;
    `);

    assert.strictEqual(-5, returnVal?.value);

    returnVal = executeReturnCode(`
        return 5*'5';
    `);

    assert.strictEqual(25, returnVal?.value);

    returnVal = executeReturnCode(`
        return 5/'5';
    `);

    assert.strictEqual(1, returnVal?.value);

    returnVal = executeReturnCode(`
        a = '1';
        b = a++;
        c = ++a;
        return [a,b,c];
    `);

    ar = (returnVal as StackVariableArray).convertToNativeArray();

    assert.strictEqual(3, ar[0]);
    assert.strictEqual(1, ar[1]);
    assert.strictEqual(3, ar[2]);

    returnVal = executeReturnCode(`
        a = '1';
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

test('030', (t) => {
    executeReturnCode(`
        return [!0, !1];
    `);
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
    returnVal = executeReturnCode('a = []; return a.foo == undefined;');
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
    // 1. DateTime.Today — полночь сегодня (локальное время)
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    let returnVal = executeReturnCode('return DateTime.Today;');
    const actualDate = new Date((returnVal?.value as number) * 1000);
    assert.strictEqual(todayMidnight.toDateString(), actualDate.toDateString());
    assert.strictEqual(0, actualDate.getHours());
    assert.strictEqual(0, actualDate.getMinutes());
    assert.strictEqual(0, actualDate.getSeconds());

    // 2. Свойства .Year, .Month, .Day
    returnVal = executeReturnCode('a = DateTime.Today; return [a.Year, a.Month, a.Day];');
    const ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(todayMidnight.getFullYear(), ar[0]);
    assert.strictEqual(todayMidnight.getMonth() + 1, ar[1]);
    assert.strictEqual(todayMidnight.getDate(), ar[2]);

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

    // 1. Неявное приведение при конкатенации
    returnVal = executeReturnCode('return "val-" + null;');
    assert.strictEqual('val-null', returnVal?.value);

    returnVal = executeReturnCode('return "val-" + true;');
    assert.strictEqual('val-true', returnVal?.value);

    returnVal = executeReturnCode('return "val-" + [1,2];');
    assert.strictEqual('val-array', returnVal?.value);

    // 2. Явное .ToString()
    returnVal = executeReturnCode('return null.ToString();');
    assert.strictEqual('null', returnVal?.value);

    returnVal = executeReturnCode('return [1,2,3].ToString();');
    assert.strictEqual('array', returnVal?.value);
});

test('039_StringCastingToNumber', (t) => {
    let returnVal;

    // 1. "10.5" * 2
    returnVal = executeReturnCode('return "10.5" * 2;');
    assert.strictEqual(21, returnVal?.value);

    // 2. "" - 5 → -5
    returnVal = executeReturnCode('return "" - 5;');
    assert.strictEqual(-5, returnVal?.value);

    // 3. "abc" - 5 → NaN
    returnVal = executeReturnCode('return ("abc" - 5).isNaN;');
    assert.strictEqual(true, returnVal?.value);

    // 4. "abc" * 1 → NaN
    returnVal = executeReturnCode('return Math.abs("abc" * 1).isNaN;');
    assert.strictEqual(true, returnVal?.value);
});

test('040_AdvancedDateTime', (t) => {
    let returnVal;

    // 1. Сравнение DateTime со строкой
    returnVal = executeReturnCode('return DateTime.Now > "2000-01-01 12:00:00";');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('return DateTime.Now < "1999-01-01 12:00:00";');
    assert.strictEqual(false, returnVal?.value);

    // 2. AddHours и свойства
    returnVal = executeReturnCode('a = DateTime.Today.AddHours(9); return [a.Day, a.Hour, a.Minute];');
    const ar = (returnVal as StackVariableArray).convertToNativeArray();
    assert.strictEqual(new Date().getDate(), ar[0]);
    assert.strictEqual(9, ar[1]);
    assert.strictEqual(0, ar[2]);

    // 3. DayOfWeek (свойство, 0=Sun..6=Sat)
    returnVal = executeReturnCode('return DateTime.Today.DayOfWeek;');
    assert.strictEqual(new Date().getDay(), returnVal?.value);
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

test('045_CoercionToNumber', (t) => {
    let returnVal;

    // 1. null + 5 → 5
    returnVal = executeReturnCode('return null + 5;');
    assert.strictEqual(5, returnVal?.value);

    // 2. true + 5 → 6
    returnVal = executeReturnCode('return true + 5;');
    assert.strictEqual(6, returnVal?.value);

    // 3. false + 5 → 5
    returnVal = executeReturnCode('return false + 5;');
    assert.strictEqual(5, returnVal?.value);
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

test('051_DoubleNegativeCasting', (t) => {
    let returnVal;

    returnVal = executeReturnCode('return !!10;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('return !!0;');
    assert.strictEqual(false, returnVal?.value);

    returnVal = executeReturnCode('return !!"hello";');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('return !!"";');
    assert.strictEqual(false, returnVal?.value);

    returnVal = executeReturnCode('return !![1,2];');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('return !![];');
    assert.strictEqual(false, returnVal?.value);

    returnVal = executeReturnCode('return !!null;');
    assert.strictEqual(false, returnVal?.value);
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
    // @ts-expect-error — метод setLimitExecInstruction может отсутствовать в TS-версии
    context.setLimitExecInstruction(10000000);
    assert.throws(() => {
        context.exec(true);
    }, /Execution limit/);
});

test('056_ArrayCoercion', (t) => {
    let returnVal;

    returnVal = executeReturnCode('return [1,2] + 1;');
    assert.strictEqual('1,21', returnVal?.value);

    returnVal = executeReturnCode('return 1 + [1,2];');
    assert.strictEqual('11,2', returnVal?.value);

    returnVal = executeReturnCode('return [1,2] + [3,4];');
    assert.strictEqual('1,23,4', returnVal?.value);
});

test('057_UnaryCoercion', (t) => {
    let returnVal;

    returnVal = executeReturnCode('return +"10.5";');
    assert.strictEqual(10.5, returnVal?.value);

    returnVal = executeReturnCode('return -true;');
    assert.strictEqual(-1, returnVal?.value);

    returnVal = executeReturnCode('return +null;');
    assert.strictEqual(0, returnVal?.value);

    returnVal = executeReturnCode('return +"";');
    assert.strictEqual(0, returnVal?.value);

    returnVal = executeReturnCode('return (+"hello").isNaN;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('return (+"[1,2]").isNaN;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('return +[];');
    assert.strictEqual(0, returnVal?.value);
});

test('058_NullVsUndefined', (t) => {
    let returnVal;

    returnVal = executeReturnCode('a = []; return a.foo == undefined;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('a = []; return a.foo == null;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('a = []; return null == a.foo;');
    assert.strictEqual(true, returnVal?.value);

    returnVal = executeReturnCode('a = []; return (null + a.foo).isNaN;');
    assert.strictEqual(true, returnVal?.value);
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

test('065_BitwiseCoercion', (t) => {
    let returnVal;

    // 1. строка → число
    returnVal = executeReturnCode('return "7" & 3;');
    assert.strictEqual(3, returnVal?.value);

    // 2. float → int (отбрасывается дробная часть)
    returnVal = executeReturnCode('return 7.7 & 3.3;');
    assert.strictEqual(3, returnVal?.value);

    // 3. boolean → int
    returnVal = executeReturnCode('return true & 3;');
    assert.strictEqual(1, returnVal?.value);

    // 4. null → int
    returnVal = executeReturnCode('return null & 3;');
    assert.strictEqual(0, returnVal?.value);

    // 5. не-числовая строка (NaN) → 0
    returnVal = executeReturnCode('return "abc" & 3;');
    assert.strictEqual(0, returnVal?.value);
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

test('069_UserFuncNoReturnGivesUndefined', (t) => {
    const returnVal = executeReturnCode(`
        function nothing(a) {
            a = a + 1;
        }
        return nothing(10);
    `);
    assert.strictEqual(VariableType.vtUndefined, returnVal?.type);
});

test('069_UserFuncBareReturn', (t) => {
    //\`return;\` без значения — undefined.
    const returnVal = executeReturnCode(`
        function f() {
            return;
        }
        return f();
    `);
    assert.strictEqual(VariableType.vtUndefined, returnVal?.type);
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
        return e.name + "|" + e.message + "|" + (e instanceof Error);
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