let searchResults = []; // Store search results globally

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func.apply(null, args);
      }, delay);
    };
  }

document.getElementById('search-btn').addEventListener('click', debounce(async () => {
  const query = document.getElementById('search-query').value;
  const sortBy = document.getElementById('sort-by').value;

  if (!query) {
    alert('Please enter a search query.');
    return;
  }

  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = 'Loading...';

  try {
    const response = await fetch(`/search?q=${encodeURIComponent(query)}&sort=${sortBy}`);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    searchResults = data.items; // Store the results globally
    resultsDiv.innerHTML = '';

    if (searchResults.length) {
      for (const item of searchResults) {
        const topAnswer = await fetchTopAnswer(item.question_id);
        const questionDiv = document.createElement('div');
        questionDiv.classList.add('question', 'card', 'mb-3');
        questionDiv.innerHTML = `
          <div class="card-body">
            <h3 class="card-title"><a href="${item.link}" target="_blank">${item.title}</a></h3>
            ${topAnswer ? `<h5>Top Answer:</h5><p>${topAnswer.slice(0, 200)}...</p>` : '<p class="text-muted">No top answer available</p>'}
          </div>
        `;
        resultsDiv.appendChild(questionDiv);
      }
    } else {
      resultsDiv.innerHTML = '<p>No results found.</p>';
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    resultsDiv.innerHTML = '<p>Error fetching results. Please try again later.</p>';
  }
}, 300));

document.getElementById('send-email-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  
  if (!email || searchResults.length === 0) {
    alert('Please enter a valid email and make sure to search first.');
    return;
  }

  try {
    const response = await fetch('/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, results: searchResults }),
    });

    if (!response.ok) {
      throw new Error('Failed to send email');
    }

    const data = await response.json();
    alert(data.message);
  } catch (error) {
    console.error('Error sending email:', error);
    alert('There was an error sending the email. Please try again later.');
  }
});

async function fetchTopAnswer(questionId) {
    try {
      const response = await fetch(`https://api.stackexchange.com/2.3/questions/${questionId}/answers?order=desc&sort=votes&site=stackoverflow&filter=!9_bDE(fI5`);
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const data = await response.json();
      // Return the top answer if available
      if (data.items && data.items.length > 0) {
        return data.items[0].body;  // Fetch the body of the top answer
      }
      return null;  // No top answer found
    } catch (error) {
      console.error(`Error fetching top answer for question ${questionId}:`, error);
      return null;
    }
  }