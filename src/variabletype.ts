
export enum VariableType {
    vtUndefined = 0,  // Неопределённый
    vtVoid = 1,       // Пустой
    vtNull = 2,       // Null
    vtInteger = 3,    // Целое число
    vtFloat = 3,      // Дробное число (алиас для vtInteger)
    vtNumber = 3,     // Число (алиас)
    vtString = 5,     // Строка
    vtBoolean = 6,    // Булево
    vtArray = 7,      // Массив
    vtObject = 8,     // Объект
    vtFunction = 9,   // Функция
}