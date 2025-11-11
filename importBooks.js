require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const Book = require('./models/Book');
const { generateEmbedding } = require('./utils/embeddings');
const axios = require('axios');

async function importBooks() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    // Load book data
    const booksData = JSON.parse(
      fs.readFileSync('vietnamese_books_data.json', 'utf8')
    );
    
    console.log(`📚 Importing ${booksData.length} books...`);

    // Clear existing data (optional)
    await Book.deleteMany({});
    console.log('🗑️  Cleared existing books');

    let successCount = 0;
    let errorCount = 0;

    for (const bookData of booksData) {
      try {
        // Generate embedding
        const text = `${bookData.title} ${bookData.author} ${bookData.description}`;
        console.log(`⏳ Processing: ${bookData.title}`);
        
        const embedding = await generateEmbedding(text);
        
        // Generate AMR
        let amr = '';
        try {
          const amrResponse = await axios.post(
            process.env.AMR_MODEL_URL,
            { sentence: bookData.description },
            { timeout: 30000 }
          );
          amr = amrResponse.data.amr || amrResponse.data.linear_amr || '';
        } catch (amrError) {
          console.log(`  ⚠️  AMR generation failed (will continue): ${amrError.message}`);
        }
        
        // Save to database
        await Book.create({
          ...bookData,
          embedding,
          amr
        });
        
        successCount++;
        console.log(`  ✅ Imported: ${bookData.title}`);
        
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error importing ${bookData.title}:`, error.message);
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📚 Total: ${booksData.length}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit();
  }
}

importBooks();