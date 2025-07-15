import saves, {
  AddSaveParams,
  GetAllSavesParams,
  GetSaveByIdParams,
  DeleteSaveParams,
  ToggleArchiveParams
} from './saves';

// Replace with a valid access token for a test user
const TEST_ACCESS_TOKEN = process.env.TEST_ACCESS_TOKEN || '<YOUR_TEST_ACCESS_TOKEN>';
const TEST_URL = 'https://example.com/test-article';

async function runSavesTests() {
  let stats = {
    addSave: false,
    getAllSaves: false,
    getSaveById: false,
    toggleArchive: false,
    deleteSave: false,
    errors: [] as string[],
  };

  console.log('--- Running Saves API Tests ---');

  // 1. Add Save
  const addParams: AddSaveParams = {
    url: TEST_URL,
    accessToken: TEST_ACCESS_TOKEN,
  };
  const addResult = await saves.addSave(addParams);
  console.log('Add Save:', addResult);
  if (addResult.success && addResult.data?.id) {
    stats.addSave = true;
  } else {
    stats.errors.push('addSave failed: ' + (addResult.error || 'Unknown error'));
    return printStats(stats);
  }
  const saveId = addResult.data.id;

  // 2. Get All Saves
  const getAllParams: GetAllSavesParams = {
    accessToken: TEST_ACCESS_TOKEN,
    page: 1,
    limit: 10,
  };
  const allResult = await saves.getAllSaves(getAllParams);
  console.log('Get All Saves:', allResult);
  if (allResult.success && Array.isArray(allResult.data?.saves)) {
    stats.getAllSaves = true;
  } else {
    stats.errors.push('getAllSaves failed: ' + (allResult.error || 'Unknown error'));
  }

  // 3. Get Save By ID
  const getByIdParams: GetSaveByIdParams = {
    id: saveId,
    accessToken: TEST_ACCESS_TOKEN,
  };
  const byIdResult = await saves.getSaveById(getByIdParams);
  console.log('Get Save By ID:', byIdResult);
  if (byIdResult.success && byIdResult.data?.id === saveId) {
    stats.getSaveById = true;
  } else {
    stats.errors.push('getSaveById failed: ' + (byIdResult.error || 'Unknown error'));
  }

  // 4. Toggle Archive
  const toggleParams: ToggleArchiveParams = {
    id: saveId,
    accessToken: TEST_ACCESS_TOKEN,
  };
  const toggleResult = await saves.toggleArchive(toggleParams);
  console.log('Toggle Archive:', toggleResult);
  if (toggleResult.success && toggleResult.data?.id === saveId) {
    stats.toggleArchive = true;
  } else {
    stats.errors.push('toggleArchive failed: ' + (toggleResult.error || 'Unknown error'));
  }

  // 5. Delete Save
  const deleteParams: DeleteSaveParams = {
    id: saveId,
    accessToken: TEST_ACCESS_TOKEN,
  };
  const deleteResult = await saves.deleteSave(deleteParams);
  console.log('Delete Save:', deleteResult);
  if (deleteResult.success) {
    stats.deleteSave = true;
  } else {
    stats.errors.push('deleteSave failed: ' + (deleteResult.error || 'Unknown error'));
  }

  printStats(stats);
}

function printStats(stats: any) {
  console.log('\n--- Test Results ---');
  console.log('Add Save:', stats.addSave ? '✅' : '❌');
  console.log('Get All Saves:', stats.getAllSaves ? '✅' : '❌');
  console.log('Get Save By ID:', stats.getSaveById ? '✅' : '❌');
  console.log('Toggle Archive:', stats.toggleArchive ? '✅' : '❌');
  console.log('Delete Save:', stats.deleteSave ? '✅' : '❌');
  if (stats.errors.length) {
    console.log('Errors:');
    stats.errors.forEach((e: string) => console.log('  -', e));
  } else {
    console.log('All tests passed!');
  }
}

if (require.main === module) {
  runSavesTests();
} 