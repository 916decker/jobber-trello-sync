require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration from environment
const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID;

// Trello API helpers
const trelloAPI = {
  async findCardByDealId(dealId) {
    try {
      console.log(`Looking for card with Deal ID: ${dealId}`);
      
      const response = await axios.get(`https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/cards`, {
  params: {
    key: TRELLO_API_KEY,
    token: TRELLO_TOKEN,
    customFieldItems: 'true'
  }
});

      const cards = response.data;
      console.log(`Found ${cards.length} cards on board`);
      for (const card of cards) {
  console.log(`Card: ${card.name}`);
  console.log(`Custom fields:`, card.customFieldItems);
}
      
      for (const card of cards) {
        if (card.customFieldItems) {
          for (const field of card.customFieldItems) {
            if (field.value && field.value.text === dealId.toString()) {
              console.log(`Match found: ${card.name}`);
              return card;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding Trello card:', error.response?.data || error.message);
      return null;
    }
  },

  async updateCardDescription(cardId, newNote) {
    try {
      const cardResponse = await axios.get(`https://api.trello.com/1/cards/${cardId}`, {
        params: {
          key: TRELLO_API_KEY,
          token: TRELLO_TOKEN,
          fields: 'desc'
        }
      });

      const currentDesc = cardResponse.data.desc || '';
      const timestamp = new Date().toLocaleString();
      
      let newDescription;
      if (currentDesc.trim()) {
        newDescription = `[${timestamp}] ${newNote}\n\n---\n\n${currentDesc}`;
      } else {
        newDescription = `[${timestamp}] ${newNote}`;
      }

      await axios.put(`https://api.trello.com/1/cards/${cardId}`, {
        key: TRELLO_API_KEY,
        token: TRELLO_TOKEN,
        desc: newDescription
      });

      return true;
    } catch (error) {
      console.error('Error updating card:', error.response?.data || error.message);
      throw error;
    }
  },

  async addComment(cardId, comment) {
    try {
      await axios.post(`https://api.trello.com/1/cards/${cardId}/actions/comments`, {
        key: TRELLO_API_KEY,
        token: TRELLO_TOKEN,
        text: comment
      });
      return true;
    } catch (error) {
      console.error('Error adding comment:', error.response?.data || error.message);
      throw error;
    }
  }
};

// Main webhook handler
app.post('/webhook/jobber', async (req, res) => {
  try {
    console.log('=== Jobber Webhook Received ===');
    console.log(JSON.stringify(req.body, null, 2));
    
    const dealId = req.body.dealId || req.body.deal_id || '745';
    const noteContent = req.body.note || req.body.content || 'Test note update from Jobber';
    
    console.log(`Processing Deal ID: ${dealId}`);
    console.log(`Note: ${noteContent}`);
    
    const trelloCard = await trelloAPI.findCardByDealId(dealId);
    
    if (!trelloCard) {
      console.log(`No Trello card found with Deal ID: ${dealId}`);
      return res.status(200).send('No matching card found');
    }
    
    console.log(`Found card: ${trelloCard.name}`);
    
    await trelloAPI.updateCardDescription(trelloCard.id, noteContent);
    await trelloAPI.addComment(trelloCard.id, `Jobber update: ${noteContent}`);
    
    console.log('✅ Successfully updated Trello card');
    res.status(200).send('Success');
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Test endpoint
app.get('/test', async (req, res) => {
  console.log('=== Testing Webhook ===');
  
  const testData = {
    dealId: '745',
    note: 'Test update: Client approved premium package!'
  };
  
  req.body = testData;
  
  try {
    const dealId = testData.dealId;
    const noteContent = testData.note;
    
    console.log(`Processing Deal ID: ${dealId}`);
    
    const trelloCard = await trelloAPI.findCardByDealId(dealId);
    
    if (!trelloCard) {
      return res.status(200).send(`No Trello card found with Deal ID: ${dealId}`);
    }
    
    await trelloAPI.updateCardDescription(trelloCard.id, noteContent);
    await trelloAPI.addComment(trelloCard.id, `Test update: ${noteContent}`);
    
    res.status(200).send('Test successful! Check your Trello card.');
    
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).send('Test failed');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.send('Server is running! ✅');
});

app.get('/', (req, res) => {
  res.send('Jobber-Trello Sync Server is running! Use /test to test the integration.');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
