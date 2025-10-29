<!-- 0cefe321-2935-444a-a2c4-a5f119e25e91 11f83dbf-07d1-4263-88ec-2096e8e54fbf -->
# Исправление фильтрации игр/уровней и инвайтов

## Проблемы

1. **Учитель видит и может изменять игры/уровни, созданные админом**

- Учитель должен видеть только свои игры и уровни (где `AuthorID` или `createdBy` = текущий `uid`)
- Админы и девелоперы должны видеть все игры/уровни организации

2. **Инвайты видны из всех организаций**

- Инвайты должны быть видны только в организации, где они были созданы
- Функция `getInvitesForOrganization` уже фильтрует по `orgId`, но нужно проверить создание инвайтов

## Решение

### 1. Фильтрация игр по роли

**Файл: `src/firebase/database.js`**

Изменить функции `getCurricularListWithCurrentOrg` и `getConjectureListWithCurrentOrg`, чтобы:

- Получать роль текущего пользователя через `getCurrentUserContext`
- Если роль = 'Teacher', фильтровать результаты по `AuthorID` или `createdBy`
- Если роль = 'Admin' или 'Developer', возвращать все игры/уровни организации

### 2. Проверка создания инвайтов

**Файл: `src/firebase/userDatabase.js`**

Проверить функцию `generateInviteCode` - убедиться, что `orgId` правильно сохраняется в инвайте.

### 3. Фильтрация уровней по роли

**Файл: `src/firebase/database.js`**

Добавить аналогичную фильтрацию для `searchConjecturesByWordWithCurrentOrg` - учители должны видеть только свои уровни в результатах поиска.

## Изменения

### `src/firebase/database.js`

1. **`getCurricularListWithCurrentOrg`**:

- Добавить получение роли и `uid` пользователя
- Фильтровать игры по `AuthorID`/`createdBy` для учителей

2. **`getConjectureListWithCurrentOrg`**:

- Добавить получение роли и `uid` пользователя
- Фильтровать уровни по `AuthorID`/`createdBy` для учителей

3. **`searchConjecturesByWordWithCurrentOrg`**:

- Добавить аналогичную фильтрацию для результатов поиска

### `src/firebase/userDatabase.js`

1. **`generateInviteCode`**:

   - Проверить, что `orgId` правильно сохраняется в `inviteData`
   - Убедиться, что при создании инвата всегда устанавливается `orgId` из параметра

2. **`getInvitesForOrganization`**:

   - Уже правильно фильтрует по `orgId`, но нужно убедиться, что инвайты создаются с правильным `orgId`

## Детали реализации

### Изменения в `src/firebase/database.js`

1. **`getCurricularListWithCurrentOrg`**:
```javascript
export const getCurricularListWithCurrentOrg = async (final) => {
  const { orgId } = await getCurrentOrgContext();
  if (!orgId) {
    console.warn("User is not in any organization.");
    return [];
  }
  
  // Get current user context to filter by role
  const userContext = await getCurrentUserContext();
  const role = userContext?.role;
  const userId = userContext?.uid || getAuth().currentUser?.uid;
  
  // Get all games in organization
  const allGames = await getCurricularList(final, orgId);
  
  // Filter by role: Teachers see only their own games
  if (role === 'Teacher' && userId && allGames) {
    return allGames.filter(game => 
      game.AuthorID === userId || game.createdBy === userId
    );
  }
  
  // Admins and Developers see all games
  return allGames || [];
};
```

2. **`getConjectureListWithCurrentOrg`**:
```javascript
export const getConjectureListWithCurrentOrg = async (final) => {
  const { orgId } = await getCurrentOrgContext();
  if (!orgId) {
    console.warn("User is not in any organization.");
    return [];
  }
  
  // Get current user context to filter by role
  const userContext = await getCurrentUserContext();
  const role = userContext?.role;
  const userId = userContext?.uid || getAuth().currentUser?.uid;
  
  // Get all levels in organization
  const allLevels = await getConjectureList(final, orgId);
  
  // Filter by role: Teachers see only their own levels
  if (role === 'Teacher' && userId && allLevels) {
    return allLevels.filter(level => 
      level.AuthorID === userId || level.createdBy === userId
    );
  }
  
  // Admins and Developers see all levels
  return allLevels || [];
};
```

3. **`searchConjecturesByWordWithCurrentOrg`**:
```javascript
export const searchConjecturesByWordWithCurrentOrg = async (searchWord) => {
  const { orgId } = await getCurrentOrgContext();
  if (!orgId) {
    console.warn("User is not in any organization.");
    return [];
  }
  
  // Get current user context to filter by role
  const userContext = await getCurrentUserContext();
  const role = userContext?.role;
  const userId = userContext?.uid || getAuth().currentUser?.uid;
  
  // Get search results
  const searchResults = await searchConjecturesByWord(searchWord, orgId);
  
  // Filter by role: Teachers see only their own levels
  if (role === 'Teacher' && userId && searchResults) {
    return searchResults.filter(level => 
      level.AuthorID === userId || level.createdBy === userId
    );
  }
  
  // Admins and Developers see all search results
  return searchResults || [];
};
```


### Изменения в `src/firebase/userDatabase.js`

**`generateInviteCode`** - проверить сохранение `orgId`:

```javascript
// В функции generateInviteCode убедиться, что:
const inviteData = {
    code: inviteCode,
    orgId: orgId,  // ← Убедиться, что orgId сохраняется
    orgName: orgName,
    role: role,
    createdBy: creatorUid,
    createdAt: now,
    status: 'active'
};
```

## Тестирование

1. Войти как учитель и проверить:

   - Видны только игры, созданные этим учителем
   - Видны только уровни, созданные этим учителем
   - В поиске показываются только уровни этого учителя

2. Войти как админ и проверить:

   - Видны все игры организации
   - Видны все уровни организации

3. Проверить инвайты:

   - Инвайты создаются с правильным `orgId`
   - Инвайты видны только в той организации, где были созданы

## Импорты и зависимости

В `src/firebase/database.js`:

- `getAuth` уже импортирован (строка 3)
- `getCurrentUserContext` нужно импортировать динамически (как в `getCurrentOrgContext`, строка 330):
  ```javascript
  const { getCurrentUserContext } = await import('./userDatabase.js');
  ```


## Дополнительные проверки

1. **`generateInviteCode`** в `userDatabase.js`:

   - Уже правильно сохраняет `orgId` (строка 872)
   - Проверить вызовы функции - убедиться, что всегда передается правильный `orgId` из текущего контекста пользователя

2. **Компоненты, которые нужно протестировать:**

   - `CurricularSelector.js` - EDIT режим (уже фильтрует, но можно упростить после наших изменений)
   - `AssignContentModule.js` - фильтрация игр для назначения классам
   - `ConjectureSelectorModule.js` - выбор уровней для редактирования

## Важные замечания

- Фильтрация применяется **только для роли 'Teacher'**
- Админы и Девелоперы всегда видят **все содержимое** организации
- Студенты не редактируют игры/уровни, поэтому фильтрация для них не нужна
- Поля для фильтрации: `AuthorID` (старое поле) и `createdBy` (новое поле) - проверяем оба для обратной совместимости
- Если `allGames`/`allLevels` === `null`, возвращаем `[]` (пустой массив)

## Шаги реализации

1. Изменить `getCurricularListWithCurrentOrg` в `database.js`
2. Изменить `getConjectureListWithCurrentOrg` в `database.js`
3. Изменить `searchConjecturesByWordWithCurrentOrg` в `database.js`
4. Проверить работу инвайтов (уже должны работать правильно)
5. Протестировать как учитель и как админ

### To-dos

- [ ] Создать файл firebase-rules.json с правилами