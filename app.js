require('dotenv').config(); 
const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;
// Add these lines to enable body parsing for JSON and form data
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

const nodemailer = require('nodemailer');
app.use(express.static('public'));


// Route to render home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/search', async (req, res) => {
    const query = req.query.q || '';
    const sortBy = req.query.sort || 'activity';
  
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
  
    //console.log(`Query: ${query}, Sort By: ${sortBy}`); // Log the query and sort parameter

    try {
      const response = await axios.get('https://api.stackexchange.com/2.3/search', {
        params: {
          intitle: query,
          order: 'desc',
          sort: sortBy,
          site: 'stackoverflow',
          filter: 'default' // This should return a standard set of question details
        }
      });
  
      // Fetch full question details for each question to include body
      const questionsWithBody = await Promise.all(
        response.data.items.map(async (item) => {
          const questionDetails = await getQuestionDetails(item.question_id);
          return questionDetails;
        })
      );
  
      res.json({ items: questionsWithBody });
    } catch (error) {
      console.error('Error fetching from StackOverflow API:', error.message, error.response?.data);
      console.error('Error fetching from StackOverflow API:', error);
      res.status(500).json({ error: 'Error fetching from StackOverflow API' });
    }
  });
  
  // Function to get detailed question information
  async function getQuestionDetails(questionId) {
    try {
      const response = await axios.get(`https://api.stackexchange.com/2.3/questions/${questionId}`, {
        params: {
          site: 'stackoverflow',
          filter: '!9_bDE(fI5' // This filter should include the body of the question
        }
      });
      return response.data.items[0]; // Return the question details
    } catch (error) {
      console.error(`Error fetching question details for ID ${questionId}:`, error);
      return null;
    }
  }
  
  // Function to fetch top answer for a question by question_id
  async function fetchTopAnswer(questionId) {
    try {
      const response = await axios.get(`https://api.stackexchange.com/2.3/questions/${questionId}/answers`, {
        params: {
          order: 'desc',
          sort: 'votes',
          site: 'stackoverflow',
          filter: '!9_bDE(fI5'  // This filter includes the body of the answers
        }
      });
  
      if (response.data.items && response.data.items.length > 0) {
        // console.log(response.data.items);
        return response.data.items[0].body;  // Fetch the body of the top answer
      }
      return null;  // No top answer found
    } catch (error) {
      console.error(`Error fetching top answer for question ${questionId}:`, error);
      return null;
    }
  }

// Create a transporter with your email provider's SMTP credentials
const transporter = nodemailer.createTransport({
    service: 'gmail', // If you're using Gmail
    auth: {
      user: process.env.EMAIL_USER, // Your email address
      pass: process.env.EMAIL_PASS, // Your email password or app-specific password
    },
  });

// Send email route
app.post('/send-email', async (req, res) => {
    const { email, results } = req.body;
  
    if (!email || !results) {
      return res.status(400).json({ error: 'Email and results are required' });
    }
    
    let data = JSON.stringify(results);
    data = JSON.parse(data); 
    // console.log('Data:', data);
    // console.log('Is Array:', Array.isArray(data));

    
    function generateHTML(data) {
        let html = `
        <h2>StackOverflow Questions</h2>
        <table border="1" cellpadding="5" cellspacing="0">
        <thead>
        <tr>
        <th>Title</th>
        <th>Tags</th>
        <th>Owner</th>
        <th>Link</th>
        </tr>
        </thead>
        <tbody>`;
        
        data.forEach(item => {
            html += `
            <tr>
            <td>${item.title}</td>
            <td>${item.tags.join(", ")}</td>
            <td><a href="${item.owner.link}">${item.owner.display_name}</a></td>
                <td><a href="${item.link}">View Question</a></td>
                </tr>`;
            });
            
            html += `
            </tbody>
            </table>
            `;
            
            return html;
        }
        
        const mailOptions = {
          from: process.env.EMAIL_USER, // Sender address
          to: email, // List of recipients
          subject: 'Search Results from StackOverflow',
          html: generateHTML(data), // Email content
        };
        
        try {
            await transporter.sendMail(mailOptions);
            res.json({ message: 'Email sent successfully!' });
        } catch (error) {
            console.error('Error sending email:', error);
            res.status(500).json({ error: 'Failed to send email' });
    }
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
