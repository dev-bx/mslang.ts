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
    constructor() {
        super(VariableType.vtObject, true);
    }

    getProperty(name: string) {
        switch (name) {
            case 'Number1':
                return new StackVariableNumber(true, 10);
            case 'Number2':
                return new StackVariableNumber(true, 20);
            case 'Number3':
                return new StackVariableNumber(true, 30);
        }

        return undefined;
    }
}

function createCodeContext(text: string) {
    const lexer = new CodeLexer(text);
    const parser = new CodeParser(lexer);

    let nodeList: ParseNode[] = [];

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

        let nodeList: ParseNode[] = [];

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
        let returnVal = executeReturnCode('a = ""; b = a.Trim; return b();');
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
    let m = (returnVal as StackVariableString).value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
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

test('025-2', (t) => {
    let returnVal;

    returnVal = executeReturnCode(`
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

        let ar = returnVal.convertToNativeArray();

        assert.strictEqual(ar[0] + '123', ar[1]);
        assert.strictEqual(4, ar[2]);
        assert.strictEqual(4, ar[3]);
    }
});

test('026', (t) => {
    let returnVal;

    returnVal = executeReturnCode(`
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

    let returnVal;

    returnVal = executeReturnCode(`
    a = [1,2,3];
    b = a;
    
    a = [b,b,b];
    
    a[0][0] = 9;
    
    return a;
    
    `);

    if (returnVal instanceof StackVariableArray) {
        let ar:unknown[][] = returnVal.convertToNativeArray() as typeof ar;

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
    let returnVal, ar;

    returnVal = executeReturnCode(`
        a = [1,2,3,4];
        return [a.pUsH('a','b','c','d'), a, a.pop()];
    `);

    let ar2:unknown[][] = (returnVal as StackVariableArray).convertToNativeArray() as typeof ar2;

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

    returnVal = executeReturnCode(`
    k1 = 'ab';
    k2 = 'cd';    
    
    ar = [k1+k2=>k1,0=>'a',1=>5];
    
    return ar.join()+'_'+ar.keys().join();
    `);

    assert.strictEqual('ab,a,5_abcd,0,1', returnVal?.value);

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
    let returnVal, ar;

    /*
    returnVal = executeReturnCode(`
        return [!0, !1, !'', !'a'];
    `);

    returnVal = executeReturnCode(`
        //return [![]];
    `);
     */

    returnVal = executeReturnCode(`
        return [!0, !1];
    `);


    //ar = returnVal.convertToNativeArray();

});