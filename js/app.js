// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api'
    : 'https://movielens-api-wmq9.onrender.com/api';

// Global state
let searchTimeout = null;
let selectedMovieForSimilar = null;

// ==================== UTILITY FUNCTIONS ====================

function scrollToSection(sectionId) {
    document.getElementById(sectionId).scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function showLoading(loadingId) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.classList.add('show');
}

function hideLoading(loadingId) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.classList.remove('show');
}

function showError(message, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="error-message">
            <p>⚠️ ${message}</p>
        </div>
    `;
}

// ==================== RECOMMENDATIONS ====================

async function getRecommendations() {
    // Get selected genres
    const genreCheckboxes = document.querySelectorAll('.genre-checkbox:checked');
    const selectedGenres = Array.from(genreCheckboxes).map(cb => cb.value);
    
    // Get other preferences
    const agePreference = document.getElementById('age-preference').value;
    const popularity = document.getElementById('popularity').value;
    const topN = parseInt(document.getElementById('num-recommendations').value);
    const minRating = parseFloat(document.getElementById('min-rating').value) || null;
    
    // Validate: at least one preference should be selected
    if (selectedGenres.length === 0 && !agePreference && !popularity) {
        showError('Please select at least one preference (genre, era, or movie type)', 'recommendations-results');
        return;
    }
    
    // Show loading
    showLoading('rec-loading');
    document.getElementById('recommendations-results').innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE_URL}/recommendations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                genres: selectedGenres,
                agePreference: agePreference,
                popularity: popularity,
                topN: topN,
                minRating: minRating
            })
        });
        
        const data = await response.json();
        
        hideLoading('rec-loading');
        
        if (!response.ok) {
            showError(data.error || 'Failed to get recommendations', 'recommendations-results');
            return;
        }
        
        displayRecommendations(data);
        
    } catch (error) {
        hideLoading('rec-loading');
        showError('Failed to connect to server. Make sure Flask backend is running.', 'recommendations-results');
        console.error('Error:', error);
    }
}

function displayRecommendations(movies) {
    const container = document.getElementById('recommendations-results');
    
    if (movies.length === 0) {
        container.innerHTML = '<p class="no-results">No movies found matching your preferences. Try adjusting your filters.</p>';
        return;
    }
    
    container.innerHTML = movies.map(movie => `
        <div class="movie-card">
            <div class="movie-poster">
                ${movie.posterUrl ? 
                    `<img src="${movie.posterUrl}" alt="${movie.title}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                         style="width: 100%; height: 100%; object-fit: cover; display: block;">
                     <div class="poster-title" style="display: none;">${movie.title}</div>` :
                    `<div class="poster-title">${movie.title}</div>`
                }
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${movie.title}</h3>
                <p class="movie-year">${movie.year || 'N/A'}</p>
                <div class="movie-ratings">
                    <span class="movie-rating">⭐ ${movie.avgRating}</span>
                    <span class="movie-rating" style="color: #4caf50;">🎯 ${movie.predictedRating}</span>
                </div>
                <p class="movie-genres">${movie.numRatings.toLocaleString()} ratings</p>
            </div>
        </div>
    `).join('');
}

// ==================== SIMILAR MOVIES ====================

async function searchMovies(query) {
    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);
    
    // Don't search if query is too short
    if (query.length < 2) {
        document.getElementById('search-results').classList.remove('show');
        return;
    }
    
    // Debounce search
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/search-movies?query=${encodeURIComponent(query)}`);
            const results = await response.json();
            displaySearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
        }
    }, 300);
}

function displaySearchResults(results) {
    const container = document.getElementById('search-results');
    
    if (results.length === 0) {
        container.classList.remove('show');
        return;
    }
    
    container.innerHTML = results.map(movie => `
        <div class="search-result-item" onclick="selectMovieForSimilar(${movie.movieId}, '${movie.title.replace(/'/g, "\\'")}')">
            <div class="search-result-title">${movie.title}</div>
            <div class="search-result-rating">⭐ ${movie.avgRating}</div>
        </div>
    `).join('');
    
    container.classList.add('show');
}

async function selectMovieForSimilar(movieId, title) {
    selectedMovieForSimilar = { movieId, title };
    
    // Update search input and hide results
    document.getElementById('movie-search').value = title;
    document.getElementById('search-results').classList.remove('show');
    
    // Get similar movies
    await getSimilarMovies(movieId, title);
}

async function getSimilarMovies(movieId, title) {
    showLoading('similar-loading');
    document.getElementById('similar-movie-results').innerHTML = '';
    document.getElementById('similar-movies-grid').innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE_URL}/similar-movies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                movieId: movieId,
                topK: 10
            })
        });
        
        const data = await response.json();
        
        hideLoading('similar-loading');
        
        if (!response.ok) {
            // Show user-friendly error message
            const errorContainer = document.getElementById('similar-movie-results');
            errorContainer.innerHTML = `
                <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 10px; padding: 2rem; margin: 2rem 0; text-align: center;">
                    <h3 style="color: #ffc107; margin-bottom: 1rem;">⚠️ No Similar Movies Available</h3>
                    <p style="color: #e0e0e0; margin-bottom: 1rem;">${data.error}</p>
                    <p style="color: #aaa; font-size: 0.9rem;">Try searching for a different movie that has more genre and tag information.</p>
                </div>
            `;
            return;
        }
        
        displaySimilarMovies(data, title);
        
    } catch (error) {
        hideLoading('similar-loading');
        showError('Failed to connect to server. Make sure Flask backend is running.', 'similar-movie-results');
        console.error('Error:', error);
    }
}

function displaySimilarMovies(movies, sourceTitle) {
    const resultsContainer = document.getElementById('similar-movie-results');
    const gridContainer = document.getElementById('similar-movies-grid');
    
    resultsContainer.innerHTML = `
        <h3 id="movies-similar">
            Movies similar to "${sourceTitle}":
        </h3>
    `;
    
    if (movies.length === 0) {
        gridContainer.innerHTML = '<p class="no-results">No similar movies found.</p>';
        return;
    }
    
    gridContainer.innerHTML = movies.map(movie => `
        <div class="movie-card">
            <div class="movie-poster">
                ${movie.posterUrl ? 
                    `<img src="${movie.posterUrl}" alt="${movie.title}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                         style="width: 100%; height: 100%; object-fit: cover; display: block;">
                     <div class="poster-title" style="display: none;">${movie.title}</div>` :
                    `<div class="poster-title">${movie.title}</div>`
                }
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${movie.title}</h3>
                <p class="movie-year">${movie.year || 'N/A'}</p>
                <div class="movie-ratings">
                    <span class="movie-rating">⭐ ${movie.avgRating}</span>
                </div>
                <p class="movie-genres">${movie.numRatings.toLocaleString()} ratings</p>
            </div>
        </div>
    `).join('');
}

// Hide search results when clicking outside
document.addEventListener('click', function(e) {
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer && !searchContainer.contains(e.target)) {
        document.getElementById('search-results').classList.remove('show');
    }
});

// ==================== INSIGHTS DASHBOARD ====================

let chartsLoaded = false;
let chartInstances = {};

async function loadInsights() {
    if (chartsLoaded) {
        // Already loaded, just scroll to charts
        document.getElementById('charts-container').scrollIntoView({ behavior: 'smooth' });
        return;
    }
    
    const button = document.getElementById('load-insights-btn');
    button.disabled = true;
    button.textContent = 'Loading...';
    
    showLoading('insights-loading');
    
    try {
        // Fetch stats
        const statsResponse = await fetch(`${API_BASE_URL}/insights/stats`);
        const stats = await statsResponse.json();
        
        // Fetch chart data
        const chartsResponse = await fetch(`${API_BASE_URL}/insights/charts`);
        const charts = await chartsResponse.json();
        
        // Fetch insight images
        const imagesResponse = await fetch(`${API_BASE_URL}/insights/images`);
        const imagesData = await imagesResponse.json();
        
        hideLoading('insights-loading');
        
        // Display stats
        displayStats(stats);
        
        // Display charts
        displayCharts(charts);
        
        // Display insight images
        displayInsightImages(imagesData.images);
        
        chartsLoaded = true;
        button.style.display = 'none';
        
    } catch (error) {
        hideLoading('insights-loading');
        button.disabled = false;
        button.textContent = 'Load Analytics Data';
        alert('Failed to load insights. Make sure Flask backend is running.');
        console.error('Error:', error);
    }
}

function displayStats(stats) {
    document.getElementById('total-movies').textContent = stats.totalMovies.toLocaleString();
    document.getElementById('avg-rating').textContent = stats.avgRating;
    document.getElementById('total-ratings').textContent = stats.totalRatings.toLocaleString();
    
    document.getElementById('insights-stats').style.display = 'grid';
}

function displayCharts(data) {
    const chartsContainer = document.getElementById('charts-container');
    chartsContainer.style.display = 'grid';
    
    // Rating Distribution Chart
    createBarChart('ratingChart', {
        labels: Object.keys(data.ratingDistribution),
        data: Object.values(data.ratingDistribution),
        label: 'Number of Movies',
        backgroundColor: 'rgba(229, 9, 20, 0.7)',
        borderColor: 'rgba(229, 9, 20, 1)'
    });
    
    // Top Genres Chart
    createBarChart('genreChart', {
        labels: Object.keys(data.topGenres),
        data: Object.values(data.topGenres),
        label: 'Number of Movies',
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)'
    });
    
    // Rating Categories Chart
    createPieChart('categoryChart', {
        labels: Object.keys(data.ratingCategories),
        data: Object.values(data.ratingCategories)
    });
}

function createBarChart(canvasId, config) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Destroy existing chart if it exists
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: config.labels,
            datasets: [{
                label: config.label,
                data: config.data,
                backgroundColor: config.backgroundColor,
                borderColor: config.borderColor,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#b0b0b0'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#b0b0b0'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

function createPieChart(canvasId, config) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Destroy existing chart if it exists
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: config.labels,
            datasets: [{
                data: config.data,
                backgroundColor: [
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(255, 99, 132, 0.7)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#b0b0b0',
                        padding: 20
                    }
                }
            }
        }
    });
}

function displayInsightImages(images) {
    // Check if we have an insights images container
    let imagesContainer = document.getElementById('insights-images-container');
    
    if (!imagesContainer) {
        // Create the container if it doesn't exist
        const chartsContainer = document.getElementById('charts-container');
        imagesContainer = document.createElement('div');
        imagesContainer.id = 'insights-images-container';
        imagesContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 2rem; margin-top: 3rem;';
        chartsContainer.parentNode.insertBefore(imagesContainer, chartsContainer.nextSibling);
    }
    
    if (!images || images.length === 0) {
        imagesContainer.innerHTML = '<p style="color: #888; text-align: center; grid-column: 1/-1;">No insight images found.</p>';
        return;
    }
    
    imagesContainer.innerHTML = images.map(filename => {
        // Generate a readable title from filename
        const title = filename
            .replace(/^\d+_/, '') // Remove leading numbers
            .replace('.png', '')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        return `
            <div class="chart-container" style="background: linear-gradient(135deg, #000000, #000000, #8b0000, #000000, #000000); background-size: 400% 400%; animation: gradientShift 8s ease infinite;">
                <h3 class="chart-title">${title}</h3>
                <img src="http://localhost:5000/insights/${filename}" 
                     alt="${title}"
                     style="width: 100%; height: auto; border-radius: 8px;"
                     onerror="this.parentElement.innerHTML='<p style=\\'color: #888; text-align: center;\\'>Failed to load image</p>'">
            </div>
        `;
    }).join('');
    
    imagesContainer.style.display = 'grid';
}

// ==================== NAVBAR SCROLL EFFECT ====================

window.addEventListener('scroll', function() {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(20, 20, 20, 0.95)';
    } else {
        navbar.style.background = 'rgba(20, 20, 20, 0.7)';
    }
});

// ==================== INITIAL LOAD ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('MovieLens Recommender System initialized');
    console.log('API Base URL:', API_BASE_URL);
    
    // Test API connection
    fetch(`${API_BASE_URL}/health`)
        .then(response => response.json())
        .then(data => console.log('✅ API Connected:', data.message))
        .catch(error => console.error('❌ API Connection Failed:', error));
});