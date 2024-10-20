require('dotenv').config(); 
const express = require('express');
const axios = require('axios');
const snoowrap = require('snoowrap');  // Reddit API library

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const nodemailer = require('nodemailer');

// Reddit API configuration
const reddit = new snoowrap({
  userAgent: process.env.REDDIT_USER_AGENT,
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  refreshToken: process.env.REDDIT_REFRESH_TOKEN
});

// Route to render home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Route to search StackOverflow and Reddit
app.get('/search', async (req, res) => {
  const query = req.query.q || '';
  const sortBy = req.query.sort || 'activity';

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    // StackOverflow API call
    const stackResponse = await axios.get('https://api.stackexchange.com/2.3/search', {
      params: {
        intitle: query,
        order: 'desc',
        sort: sortBy,
        site: 'stackoverflow',
        filter: 'default'
      }
    });

    // Fetch Reddit posts
    const redditResults = await reddit.search({
      query: query,
      sort: sortBy === 'activity' ? 'relevance' : sortBy,  // Map sortBy to Reddit's sorting options
      time: 'all'
    });

    //Fetch detailed StackOverflow questions
    const questionsWithBody = await Promise.all(
      stackResponse.data.items.map(async (item) => {
        const questionDetails = await getQuestionDetails(item.question_id);
        return questionDetails;
      })
    );

    // Process Reddit results
    const redditPosts = redditResults.map(post => ({
      title: post.title,
      subreddit: post.subreddit.display_name,
      author: post.author.name,
      url: `https://reddit.com${post.permalink}`
    }));

    // console.log(redditPosts);
    
    res.status(200).json({
      stackOverflow: questionsWithBody,
      reddit: redditPosts
    });

  } catch (error) {
    console.error('Error fetching from APIs:', error);
    res.status(500).json({ error: 'Error fetching from APIs' });
  }
});

// Function to get detailed StackOverflow question information
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

// Email setup remains the same
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post('/send-email', async (req, res) => {
  const { email, results } = req.body;

  if (!email || !results) {
    return res.status(400).json({ error: 'Email and results are required' });
  }

  // Separate StackOverflow and Reddit data
  const stackOverflowResults = results.filter(item => item.question_id); // StackOverflow questions
  const redditResults = results.filter(item => item.subreddit); // Reddit posts

  // Function to generate HTML content
  function generateHTML(stackOverflowResults, redditResults) {
    let html = `
    <h2>Search Results</h2>
    <h3>StackOverflow Questions</h3>
    <table border="1" cellpadding="5" cellspacing="0">
    <thead>
    <tr><th>Title</th><th>Tags</th><th>Owner</th><th>Link</th></tr>
    </thead><tbody>`;

    // StackOverflow questions
    stackOverflowResults.forEach(item => {
      html += `
      <tr>
      <td>${item.title}</td>
      <td>${item.tags ? item.tags.join(", ") : "No tags"}</td>
      <td><a href="${item.owner.link}">${item.owner.display_name}</a></td>
      <td><a href="${item.link}">View Question</a></td>
      </tr>`;
    });

    html += `</tbody></table><h3>Reddit Posts</h3><table border="1" cellpadding="5" cellspacing="0">
    <thead><tr><th>Title</th><th>Subreddit</th><th>Author</th><th>Link</th></tr></thead><tbody>`;
    
    // Reddit posts
    redditResults.forEach(post => {
      html += `
      <tr>
      <td>${post.title}</td>
      <td>${post.subreddit}</td>
      <td>${post.author}</td>
      <td><a href="${post.url}">View Post</a></td>
      </tr>`;
    });

    html += `</tbody></table>`;
    
    return html;
  }

  // Generate the HTML with the separated StackOverflow and Reddit data
  const mailContent = generateHTML(stackOverflowResults, redditResults);

  // Prepare email options
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Search Results from StackOverflow and Reddit',
    html: mailContent,
  };

  // Send email
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
