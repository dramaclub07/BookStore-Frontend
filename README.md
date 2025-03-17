<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bookstore - Login</title>
</head>
<body>
  <div class="container">
    <!-- Left Section -->
    <div class="left-section">
      <div class="illustration">
        <img src="https://via.placeholder.com/150" alt="Shopping Illustration">
      </div>
      <h2>Online Book Shopping</h2>
    </div>

    <!-- Right Section -->
    <div class="right-section">
      <div class="tabs">
        <a href="#" class="active">Login</a>
        <a href="#" class="inactive">Signup</a>
      </div>
      <form id="login-form">
        <div class="form-group">
          <label>Email ID</label>
          <input type="email" id="email" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="password" required>
        </div>
        <a href="#" class="forgot-password">Forgot Password?</a>
        <button type="submit" class="login-btn">Login</button>
      </form>
      <div class="separator">OR</div>
      <div class="social-buttons">
        <button class="facebook">Facebook</button>
        <button class="google">Google</button>
      </div>
    </div>
  </div>
</body>
</html>



<script>
    document.getElementById('login-form').addEventListener('submit', function(e) {
      e.preventDefault();
  
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
  
      console.log('Attempting login with:', { email, password });
  
      fetch('http://127.0.0.1:3000/api/v1/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
        .then(response => {
          console.log('Response status:', response.status);
          return response.json().catch(() => { throw new Error('Invalid JSON response'); });
        })
        .then(data => {
          console.log('Response data:', data);
  
          if (data) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user)); // Store user info
            alert('Login successful!');
            window.location.href = 'profile.html';
          } else {
            alert('Login failed: ' + (data.error || 'Invalid credentials'));
          }
        })
        .catch(error => {
          console.error('Error during login:', error);
          alert('An error occurred. Please check the console for details.');
        });
    });
  </script>
  




<style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #6D6D6D;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }

    .container {
      display: flex;
      background-color: white;
      border-radius: 10px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      width: 800px;
      height: 500px;
    }

    .left-section {
      background-color: white;
      width: 50%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .illustration {
      width: 200px;
      height: 200px;
      background-color: #4A90E2;
      border-radius: 50%;
      margin-bottom: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .illustration img {
      width: 150px;
      height: 150px;
    }

    .left-section h2 {
      font-size: 24px;
      font-weight: bold;
      text-transform: uppercase;
      color: #333;
      margin: 0;
    }

    .right-section {
      background-color: white;
      width: 50%;
      padding: 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .tabs {
      display: flex;
      margin-bottom: 30px;
    }

    .tabs a {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      text-decoration: none;
      margin-right: 20px;
      padding-bottom: 5px;
    }

    .tabs .active {
      color: #8B1E3F;
      border-bottom: 2px solid #8B1E3F;
    }

    .tabs .inactive {
      color: #999;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }

    .form-group input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 14px;
      color: #333;
      box-sizing: border-box;
    }

    .forgot-password {
      display: block;
      text-align: right;
      font-size: 14px;
      color: #8B1E3F;
      text-decoration: none;
      margin-bottom: 20px;
    }

    .login-btn {
      background-color: #8B1E3F;
      color: white;
      padding: 12px;
      border: none;
      border-radius: 5px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      width: 100%;
      transition: background-color 0.3s;
    }

    .login-btn:hover {
      background-color: #6B1631;
    }

    .separator {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 20px 0;
      color: #666;
      font-size: 14px;
    }

    .separator::before,
    .separator::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid #ddd;
      margin: 0 10px;
    }

    .social-buttons {
      display: flex;
      justify-content: space-between;
    }

    .social-buttons button {
      width: 48%;
      padding: 10px;
      border: none;
      border-radius: 5px;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.3s;
    }

    .social-buttons .facebook {
      background-color: #3B5998;
      color: white;
    }

    .social-buttons .facebook:hover {
      background-color: #2D4373;
    }

    .social-buttons .google {
      background-color: #D3D3D3;
      color: #333;
    }

    .social-buttons .google:hover {
      background-color: #B0B0B0;
    }
  </style>