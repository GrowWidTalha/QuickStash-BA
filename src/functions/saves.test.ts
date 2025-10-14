import saves, {
  AddSaveParams,
  GetAllSavesParams,
  GetSaveByIdParams,
  DeleteSaveParams,
  ToggleArchiveParams
} from './saves';

// Replace with a valid DB user id for a test user
const TEST_USER_ID = process.env.TEST_USER_ID || '<YOUR_TEST_USER_ID>';
const TEST_URL = 'https://example.com/test-article-123'; // Changed URL to avoid "URL already saved" in repeated tests
const TEST_TITLE = "Test Article Title";
const TEST_EXCERPT = "This is a test excerpt for the article.";
const TEST_FAVICON_URL = "https://example.com/favicon.ico";

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
    userId: TEST_USER_ID,
    title: TEST_TITLE,
    excerpt: TEST_EXCERPT,
    favicon_url: TEST_FAVICON_URL,
  };
  console.log('Add Save Params:', addParams); // Log params for debugging
  const addResult = await saves.addSave(addParams);
  console.log('Add Save Result:', addResult);
  if (addResult.success && addResult.data?.id) {
    if (addResult.data.title === TEST_TITLE &&
        addResult.data.excerpt === TEST_EXCERPT &&
        addResult.data.favicon_url === TEST_FAVICON_URL) {
      stats.addSave = true;
    } else {
      stats.errors.push('addSave failed: returned data mismatch');
    }
  } else {
    stats.errors.push('addSave failed: ' + (addResult.error || 'Unknown error'));
    return printStats(stats);
  }
  const saveId = addResult.data.id;

  // 2. Get All Saves
  const getAllParams: GetAllSavesParams = {
    userId: TEST_USER_ID,
    page: 1,
    limit: 10,
  };
  const allResult = await saves.getAllSaves(getAllParams);
  console.log('Get All Saves Result:', allResult);
  if (allResult.success && Array.isArray(allResult.data?.saves)) {
    const foundSave = allResult.data.saves.find(save => save.id === saveId);
    if (foundSave &&
        foundSave.title === TEST_TITLE &&
        foundSave.excerpt === TEST_EXCERPT &&
        foundSave.favicon_url === TEST_FAVICON_URL &&
        foundSave.url === TEST_URL) {
      stats.getAllSaves = true;
    } else {
      stats.errors.push('getAllSaves failed: did not find the added save with correct data');
    }
  } else {
    stats.errors.push('getAllSaves failed: ' + (allResult.error || 'Unknown error'));
  }

  // 3. Get Save By ID
  const getByIdParams: GetSaveByIdParams = {
    id: saveId,
    userId: TEST_USER_ID,
  };
  const byIdResult = await saves.getSaveById(getByIdParams);
  console.log('Get Save By ID Result:', byIdResult);
  if (byIdResult.success && byIdResult.data?.id === saveId) {
    if (byIdResult.data.title === TEST_TITLE &&
        byIdResult.data.excerpt === TEST_EXCERPT &&
        byIdResult.data.favicon_url === TEST_FAVICON_URL &&
        byIdResult.data.url === TEST_URL) {
      stats.getSaveById = true;
    } else {
      stats.errors.push('getSaveById failed: returned data mismatch');
    }
  } else {
    stats.errors.push('getSaveById failed: ' + (byIdResult.error || 'Unknown error'));
  }

  // 4. Toggle Archive
  const toggleParams: ToggleArchiveParams = {
    id: saveId,
    userId: TEST_USER_ID,
  };
  const toggleResult = await saves.toggleArchive(toggleParams);
  console.log('Toggle Archive Result:', toggleResult);
  if (toggleResult.success && toggleResult.data?.id === saveId) {
    stats.toggleArchive = true;
  } else {
    stats.errors.push('toggleArchive failed: ' + (toggleResult.error || 'Unknown error'));
  }

  // 5. Delete Save
  const deleteParams: DeleteSaveParams = {
    id: saveId,
    userId: TEST_USER_ID,
  };
  const deleteResult = await saves.deleteSave(deleteParams);
  console.log('Delete Save Result:', deleteResult);
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