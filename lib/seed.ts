import { ID } from "react-native-appwrite";
import { appwriteConfig, databases, storage } from "./appwrite";
import dummyData from "./data";

interface Category {
    name: string;
    description: string;
}

interface Customization {
    name: string;
    price: number;
    type: "topping" | "side" | "size" | "crust" | string; // extend as needed
}

interface MenuItem {
    name: string;
    description: string;
    image_url: string;
    price: number;
    rating: number;
    calories: number;
    protein: number;
    category_name: string;
    customizations: string[]; // list of customization names
}

interface DummyData {
    categories: Category[];
    customizations: Customization[];
    menu: MenuItem[];
}

// ensure dummyData has correct shape
const data = dummyData as DummyData;

// Helper function to validate collection exists
async function validateCollection(collectionId: string, collectionName: string): Promise<boolean> {
    try {
        console.log(`🔍 Validating collection: ${collectionName} (ID: ${collectionId})`);
        
        const result = await databases.listDocuments(
            appwriteConfig.databaseId,
            collectionId,
            []
        );
        
        console.log(`✅ Collection ${collectionName} is valid. Found ${result.documents.length} documents.`);
        return true;
    } catch (error) {
        console.error(`❌ Collection ${collectionName} validation failed:`, {
            collectionId,
            error: error.message,
            code: error.code,
            type: error.type
        });
        return false;
    }
}

// Helper function to validate storage bucket
async function validateStorage(): Promise<boolean> {
    try {
        console.log(`🔍 Validating storage bucket: ${appwriteConfig.bucketId}`);
        
        const result = await storage.listFiles(appwriteConfig.bucketId);
        
        console.log(`✅ Storage bucket is valid. Found ${result.files.length} files.`);
        return true;
    } catch (error) {
        console.error(`❌ Storage bucket validation failed:`, {
            bucketId: appwriteConfig.bucketId,
            error: error.message,
            code: error.code,
            type: error.type
        });
        return false;
    }
}

// Validate all required collections and storage
async function validateAppwriteConfig(): Promise<boolean> {
    console.log('\n🚀 Starting Appwrite Configuration Validation...');
    console.log('📋 Configuration Details:');
    console.log({
        endpoint: appwriteConfig.endpoint,
        projectId: appwriteConfig.projectId,
        databaseId: appwriteConfig.databaseId,
        categoriesCollectionId: appwriteConfig.categoriesCollectionId,
        customizationsCollectionId: appwriteConfig.customizationsCollectionId,
        menuCollectionId: appwriteConfig.menuCollectionId,
        menuCustomizationsCollectionId: appwriteConfig.menuCustomizationsCollectionId,
        bucketId: appwriteConfig.bucketId,
    });

    const validations = [
        validateCollection(appwriteConfig.categoriesCollectionId, 'Categories'),
        validateCollection(appwriteConfig.customizationsCollectionId, 'Customizations'),
        validateCollection(appwriteConfig.menuCollectionId, 'Menu'),
        validateCollection(appwriteConfig.menuCustomizationsCollectionId, 'MenuCustomizations'),
        validateStorage()
    ];

    const results = await Promise.allSettled(validations);
    
    const allValid = results.every(result => 
        result.status === 'fulfilled' && result.value === true
    );

    if (allValid) {
        console.log('\n✅ All collections and storage are valid!');
    } else {
        console.log('\n❌ Some collections or storage failed validation.');
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Validation ${index + 1} rejected:`, result.reason);
            }
        });
    }

    return allValid;
}

async function clearAll(collectionId: string, collectionName: string): Promise<void> {
    try {
        console.log(`🧹 Clearing collection: ${collectionName}`);
        
        const list = await databases.listDocuments(
            appwriteConfig.databaseId,
            collectionId
        );

        console.log(`📊 Found ${list.documents.length} documents to delete in ${collectionName}`);

        if (list.documents.length === 0) {
            console.log(`✅ Collection ${collectionName} is already empty`);
            return;
        }

        await Promise.all(
            list.documents.map(async (doc, index) => {
                try {
                    await databases.deleteDocument(appwriteConfig.databaseId, collectionId, doc.$id);
                    console.log(`🗑️  Deleted document ${index + 1}/${list.documents.length} from ${collectionName}`);
                } catch (error) {
                    console.error(`❌ Failed to delete document ${doc.$id} from ${collectionName}:`, error.message);
                    throw error;
                }
            })
        );

        console.log(`✅ Successfully cleared collection: ${collectionName}`);
    } catch (error) {
        console.error(`❌ Error clearing collection ${collectionName}:`, error);
        throw error;
    }
}

async function clearStorage(): Promise<void> {
    try {
        console.log(`🧹 Clearing storage bucket`);
        
        const list = await storage.listFiles(appwriteConfig.bucketId);

        console.log(`📊 Found ${list.files.length} files to delete in storage`);

        if (list.files.length === 0) {
            console.log(`✅ Storage bucket is already empty`);
            return;
        }

        await Promise.all(
            list.files.map(async (file, index) => {
                try {
                    await storage.deleteFile(appwriteConfig.bucketId, file.$id);
                    console.log(`🗑️  Deleted file ${index + 1}/${list.files.length} from storage`);
                } catch (error) {
                    console.error(`❌ Failed to delete file ${file.$id}:`, error.message);
                    throw error;
                }
            })
        );

        console.log(`✅ Successfully cleared storage bucket`);
    } catch (error) {
        console.error(`❌ Error clearing storage:`, error);
        throw error;
    }
}

async function uploadImageToStorage(imageUrl: string, itemName: string): Promise<string> {
    try {
        console.log(`📸 Uploading image for ${itemName}: ${imageUrl}`);
        
        // First, test if the image URL is accessible
        const response = await fetch(imageUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log(`📦 Image blob created: ${blob.size} bytes, type: ${blob.type}`);

        // Convert blob to File object for React Native
        const fileName = imageUrl.split("/").pop() || `${itemName.replace(/\s+/g, '_')}-${Date.now()}.jpg`;
        
        // Create file object in React Native compatible format
        const fileObj = {
            name: fileName,
            type: blob.type || 'image/jpeg',
            size: blob.size,
            uri: imageUrl,
        };

        console.log(`📁 File object created:`, {
            name: fileObj.name,
            type: fileObj.type,
            size: fileObj.size,
            uri: fileObj.uri.substring(0, 50) + '...'
        });

        // Try uploading with retry logic
        const file = await retryOperation(
            () => storage.createFile(
                appwriteConfig.bucketId,
                ID.unique(),
                fileObj
            ),
            3,
            `Upload image for ${itemName}`
        );

        const fileUrl = storage.getFileViewURL(appwriteConfig.bucketId, file.$id);
        console.log(`✅ Image uploaded successfully for ${itemName}: ${file.$id}`);
        
        return fileUrl;
    } catch (error) {
        console.error(`❌ Failed to upload image for ${itemName}:`, error);
        
        // Return the original URL as fallback
        console.log(`🔄 Using original URL as fallback for ${itemName}`);
        return imageUrl;
    }
}

// Helper function for retry logic
async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    operationName: string
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries} for: ${operationName}`);
            const result = await operation();
            
            if (attempt > 1) {
                console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            console.error(`❌ Attempt ${attempt}/${maxRetries} failed for ${operationName}:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

async function createCategories(): Promise<Record<string, string>> {
    console.log('\n📂 Creating Categories...');
    const categoryMap: Record<string, string> = {};
    
    for (let i = 0; i < data.categories.length; i++) {
        const cat = data.categories[i];
        try {
            console.log(`📝 Creating category ${i + 1}/${data.categories.length}: ${cat.name}`);
            
            const doc = await databases.createDocument(
                appwriteConfig.databaseId,
                appwriteConfig.categoriesCollectionId,
                ID.unique(),
                {
                    name: cat.name,
                    description: cat.description
                }
            );
            
            categoryMap[cat.name] = doc.$id;
            console.log(`✅ Created category: ${cat.name} (ID: ${doc.$id})`);
        } catch (error) {
            console.error(`❌ Failed to create category ${cat.name}:`, error);
            throw error;
        }
    }
    
    console.log(`✅ Successfully created ${Object.keys(categoryMap).length} categories`);
    return categoryMap;
}

async function createCustomizations(): Promise<Record<string, string>> {
    console.log('\n🎨 Creating Customizations...');
    const customizationMap: Record<string, string> = {};
    
    for (let i = 0; i < data.customizations.length; i++) {
        const cus = data.customizations[i];
        try {
            console.log(`📝 Creating customization ${i + 1}/${data.customizations.length}: ${cus.name}`);
            
            const doc = await databases.createDocument(
                appwriteConfig.databaseId,
                appwriteConfig.customizationsCollectionId,
                ID.unique(),
                {
                    name: cus.name,
                    price: cus.price,
                    type: cus.type,
                }
            );
            
            customizationMap[cus.name] = doc.$id;
            console.log(`✅ Created customization: ${cus.name} (ID: ${doc.$id})`);
        } catch (error) {
            console.error(`❌ Failed to create customization ${cus.name}:`, error);
            throw error;
        }
    }
    
    console.log(`✅ Successfully created ${Object.keys(customizationMap).length} customizations`);
    return customizationMap;
}

async function createMenuItems(categoryMap: Record<string, string>, customizationMap: Record<string, string>): Promise<Record<string, string>> {
    console.log('\n🍽️ Creating Menu Items...');
    const menuMap: Record<string, string> = {};
    
    for (let i = 0; i < data.menu.length; i++) {
        const item = data.menu[i];
        try {
            console.log(`📝 Creating menu item ${i + 1}/${data.menu.length}: ${item.name}`);
            
            // Validate category exists
            if (!categoryMap[item.category_name]) {
                throw new Error(`Category "${item.category_name}" not found in categoryMap`);
            }
            
            // Upload image with fallback
            let uploadedImage: string;
            try {
                uploadedImage = await uploadImageToStorage(item.image_url, item.name);
            } catch (error) {
                console.warn(`⚠️  Image upload failed for ${item.name}, using original URL`);
                uploadedImage = item.image_url;
            }

            // Create menu item with retry logic
            const doc = await retryOperation(
                () => databases.createDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.menuCollectionId,
                    ID.unique(),
                    {
                        name: item.name,
                        description: item.description,
                        image_url: uploadedImage,
                        price: item.price,
                        rating: item.rating,
                        calories: item.calories,
                        protein: item.protein,
                        categories: categoryMap[item.category_name],
                    }
                ),
                3,
                `Create menu item: ${item.name}`
            );

            menuMap[item.name] = doc.$id;
            console.log(`✅ Created menu item: ${item.name} (ID: ${doc.$id})`);

            // Create menu_customizations
            console.log(`🔗 Creating ${item.customizations.length} customizations for ${item.name}`);
            for (let j = 0; j < item.customizations.length; j++) {
                const cusName = item.customizations[j];
                
                if (!customizationMap[cusName]) {
                    console.warn(`⚠️  Customization "${cusName}" not found for item "${item.name}"`);
                    continue;
                }
                
                try {
                    await retryOperation(
                        () => databases.createDocument(
                            appwriteConfig.databaseId,
                            appwriteConfig.menuCustomizationsCollectionId,
                            ID.unique(),
                            {
                                menu: doc.$id,
                                customizations: customizationMap[cusName],
                            }
                        ),
                        3,
                        `Link customization "${cusName}" to "${item.name}"`
                    );
                    console.log(`✅ Linked customization "${cusName}" to "${item.name}"`);
                } catch (error) {
                    console.error(`❌ Failed to link customization "${cusName}" to "${item.name}":`, error);
                    // Don't throw here, continue with other customizations
                }
            }
        } catch (error) {
            console.error(`❌ Failed to create menu item ${item.name}:`, error);
            
            // Ask user if they want to continue or stop
            console.log(`🤔 Do you want to continue with remaining items or stop here?`);
            console.log(`📊 Progress: ${i}/${data.menu.length} items completed`);
            
            // For now, continue with next item instead of stopping everything
            console.log(`🔄 Continuing with next menu item...`);
            continue;
        }
    }
    
    console.log(`✅ Successfully created ${Object.keys(menuMap).length} menu items`);
    return menuMap;
}

async function seed(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🌱 Starting Seed Process...');
    console.log(`📅 Started at: ${new Date().toISOString()}`);

    try {
        // Step 1: Validate configuration
        console.log('\n=== STEP 1: VALIDATING CONFIGURATION ===');
        const isValid = await validateAppwriteConfig();
        if (!isValid) {
            throw new Error('Configuration validation failed. Please check your collection IDs and permissions.');
        }

        // Step 2: Clear existing data
        console.log('\n=== STEP 2: CLEARING EXISTING DATA ===');
        await clearAll(appwriteConfig.categoriesCollectionId, 'Categories');
        await clearAll(appwriteConfig.customizationsCollectionId, 'Customizations');
        await clearAll(appwriteConfig.menuCollectionId, 'Menu');
        await clearAll(appwriteConfig.menuCustomizationsCollectionId, 'MenuCustomizations');
        await clearStorage();

        // Step 3: Create categories
        console.log('\n=== STEP 3: CREATING CATEGORIES ===');
        const categoryMap = await createCategories();

        // Step 4: Create customizations
        console.log('\n=== STEP 4: CREATING CUSTOMIZATIONS ===');
        const customizationMap = await createCustomizations();

        // Step 5: Create menu items
        console.log('\n=== STEP 5: CREATING MENU ITEMS ===');
        const menuMap = await createMenuItems(categoryMap, customizationMap);

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log('\n🎉 SEEDING COMPLETED SUCCESSFULLY!');
        console.log(`📊 Summary:`);
        console.log(`   - Categories created: ${Object.keys(categoryMap).length}`);
        console.log(`   - Customizations created: ${Object.keys(customizationMap).length}`);
        console.log(`   - Menu items created: ${Object.keys(menuMap).length}`);
        console.log(`   - Total duration: ${duration.toFixed(2)} seconds`);
        console.log(`📅 Completed at: ${new Date().toISOString()}`);

    } catch (error) {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.error('\n💥 SEEDING FAILED!');
        console.error(`❌ Error: ${error.message}`);
        console.error(`📊 Failed after: ${duration.toFixed(2)} seconds`);
        console.error(`📅 Failed at: ${new Date().toISOString()}`);
        
        if (error.code) {
            console.error(`🔍 Error Code: ${error.code}`);
        }
        if (error.type) {
            console.error(`🔍 Error Type: ${error.type}`);
        }
        
        console.error('📋 Full error details:', error);
        throw error;
    }
}

export default seed;