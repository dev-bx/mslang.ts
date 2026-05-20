
export enum VariableType {
    vtUndefined = 0,  // Неопределённый
    vtVoid = 1,       // Пустой
    vtNull = 2,       // Null
    vtInteger = 3,    // Целое число
    vtFloat = 3,      // Дробное число (алиас для vtInteger)
    vtNumber = 3,     // Число (алиас)
    vtString = 4,     // Строка
    vtBoolean = 5,    // Булево
    vtArray = 6,      // Массив
    vtObject = 7,     // Объект
    vtFunction = 8,   // Функция
}