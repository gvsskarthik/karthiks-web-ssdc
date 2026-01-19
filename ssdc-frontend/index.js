function showSignup() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
}

function showLogin() {
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
}

// TEMP login logic
document.getElementById("loginForm").addEventListener("submit", function(e){
  e.preventDefault();
  if (
          document.getElementById("loginUser").value === "admin" &&
          document.getElementById("loginPass").value === "1234"
  ) {
    window.location.href = "dashboard.html";
  } else {
    alert("Invalid login");
  }
});

// TEMP signup logic
document.getElementById("signupForm").addEventListener("submit", function(e){
  e.preventDefault();
  alert("Signup successful! Now login.");
  showLogin();
});
