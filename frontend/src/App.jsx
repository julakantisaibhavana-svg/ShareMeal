
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "https://sharemeal-backend-yfo9.onrender.com/api/donations";
const AUTH_URL = "https://sharemeal-backend-yfo9.onrender.com/api/auth";

const emptyDonation = {
  donorName: "",
  foodName: "",
  category: "Meals",
  quantity: "",
  location: "",
  pickupDeadline: "",
};

const getTimeLeft = (deadline) => {
  if (!deadline) return "Not specified";

  const difference = new Date(deadline) - new Date();

  if (difference <= 0) return "Expired";

  const hours = Math.floor(difference / (1000 * 60 * 60));
  const minutes = Math.floor(
    (difference % (1000 * 60 * 60)) / (1000 * 60)
  );

  if (hours >= 24) {
    return `${Math.floor(hours / 24)} day(s) left`;
  }

  return `${hours} hr ${minutes} min left`;
};


const getFoodImage = (category) => {
  const images = {
    Meals:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=700",
    Fruits:
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=700",
    Vegetables:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=700",
    Snacks:
      "https://images.unsplash.com/photo-1621939514649-280e2aa2f2f2?w=700",
    Bakery:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=700",
    Others:
      "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=700",
  };

  return images[category] || images.Others;
};


function App() {
  const [foods, setFoods] = useState([]);
  const [token, setToken] = useState(
    localStorage.getItem("sharemealToken") || ""
  );
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sharemealUser")) || null;
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState("home");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "receiver",
  });

  const [donationForm, setDonationForm] = useState(emptyDonation);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // LOAD DONATIONS
  const loadFoods = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load donations");
      }

      setFoods(Array.isArray(data) ? data : data.donations || []);
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    }
  };

  useEffect(() => {
    loadFoods();
  }, []);

  // SCROLL TO SECTION
  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
    });
  };

  // AUTHENTICATION
  const handleAuthChange = (e) => {
    setAuthForm({
      ...authForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const endpoint =
        authMode === "register" ? "/register" : "/login";

      const payload =
        authMode === "register"
          ? authForm
          : {
              email: authForm.email,
              password: authForm.password,
            };

      const response = await fetch(`${AUTH_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      const receivedToken = data.token;
      const receivedUser = data.user;

      if (!receivedToken || !receivedUser) {
        throw new Error("Login response is missing user or token.");
      }

      localStorage.setItem("sharemealToken", receivedToken);
      localStorage.setItem(
        "sharemealUser",
        JSON.stringify(receivedUser)
      );

      setToken(receivedToken);
      setUser(receivedUser);
      setPage("home");
      setMessage("Welcome to ShareMeal!");
      setAuthForm({
        name: "",
        email: "",
        password: "",
        role: "receiver",
      });

      await loadFoods();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("sharemealToken");
    localStorage.removeItem("sharemealUser");

    setToken("");
    setUser(null);
    setPage("home");
    setMessage("You have been logged out.");
    setError("");
  };

  // CREATE DONATION
  const handleDonationChange = (e) => {
    setDonationForm({
      ...donationForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token || user?.role !== "donor") {
      setError("Please sign in as a donor to donate food.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          ...donationForm,
          donorName: user.name || donationForm.donorName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not create donation.");
      }

      setDonationForm(emptyDonation);
      setMessage("Your food donation was added successfully!");
      await loadFoods();
      setPage("home");

      setTimeout(() => scrollToSection("donations"), 150);
    } catch (err) {
      setError(err.message || "Could not create donation.");
    } finally {
      setLoading(false);
    }
  };

  // RESERVE FOOD
  const requestFood = async (id) => {
    if (!token || user?.role !== "receiver") {
      setError("Please sign in as a receiver to request food.");
      setPage("auth");
      setAuthMode("login");
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status: "Reserved" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not reserve this food.");
      }

      setMessage("Food reserved successfully!");
      await loadFoods();
    } catch (err) {
      setError(err.message || "Could not reserve food.");
    }
  };

  // MARK FOOD AS COLLECTED
  const markAsCollected = async (id) => {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status: "Collected" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not update food status.");
      }

      setMessage("Food marked as collected!");
      await loadFoods();
    } catch (err) {
      setError(err.message || "Could not update food status.");
    }
  };

  // DELETE DONATION
  const deleteDonation = async (id) => {
    if (!window.confirm("Are you sure you want to delete this donation?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not delete donation.");
      }

      setMessage("Donation deleted successfully!");
      await loadFoods();
    } catch (err) {
      setError(err.message || "Could not delete donation.");
    }
  };

  // FILTER DONATIONS
  const filteredFoods = useMemo(() => {
    return foods.filter((food) => {
      const matchesSearch =
        (food.foodName || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (food.location || "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesCategory =
        categoryFilter === "All" ||
        food.category === categoryFilter;

      const matchesStatus =
        statusFilter === "All" ||
        (food.status || "Available") === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [foods, search, categoryFilter, statusFilter]);

  // IMPACT COUNTS FROM DATABASE
  const mealsDonated = foods.length;

  const partnerCount = new Set(
    foods.map((food) => food.donorName).filter(Boolean)
  ).size;

  const peopleHelped = foods.filter(
    (food) => food.status === "Collected"
  ).length;

  const myDonations = foods.filter(
    (food) => food.donorName === user?.name
  );

  const myReservedFoods = foods.filter(
    (food) => food.status === "Reserved"
  );

  return (
    <div className="app">
      {/* NAVBAR */}
      <nav className="navbar">
        <a
          href="#home"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className="brand-icon">♡</span>
          <span>ShareMeal</span>
        </a>

        <div className="nav-links">
          <a href="#donations" onClick={() => setPage("home")}>
            Find Meals
          </a>
          <a href="#about" onClick={() => setPage("home")}>
            About
          </a>
          <a href="#how-it-works" onClick={() => setPage("home")}>
            How It Works
          </a>
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <span className="welcome-user">
                Hi, {user.name}
              </span>
              <button className="nav-signin" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <button
              className="nav-signin"
              onClick={() => {
                setAuthMode("login");
                setPage("auth");
                setError("");
              }}
            >
              Sign In
            </button>
          )}

          <button
            className="nav-donate-btn"
            onClick={() => {
              if (user?.role === "donor") {
                setPage("donate");
                setError("");
                setTimeout(
                  () => scrollToSection("donation-form"),
                  100
                );
              } else {
                setAuthMode("login");
                setPage("auth");
                setError(
                  user
                    ? "Only donor accounts can donate food."
                    : "Please sign in as a donor to donate food."
                );
              }
            }}
          >
            ♡ Donate Now
          </button>
        </div>
      </nav>

      {/* HOMEPAGE HERO */}
      {page === "home" && (
        <>
          <section className="hero" id="home">
            <div className="hero-overlay"></div>

            <div className="hero-content">
              <h1>
                Bridge the Gap
                <br />
                with a Meal
              </h1>

              <p>
                Connect generous hearts with hungry neighbors.
                Purchase meals from local restaurants for others to
                enjoy for free.
              </p>

              <div className="hero-actions">
                <button
                  className="hero-donate-btn"
                  onClick={() => {
                    if (user?.role === "donor") {
                      setPage("donate");
                      setTimeout(
                        () => scrollToSection("donation-form"),
                        100
                      );
                    } else {
                      setAuthMode("login");
                      setPage("auth");
                      setError(
                        user
                          ? "Only donor accounts can donate food."
                          : "Please sign in as a donor to donate a meal."
                      );
                    }
                  }}
                >
                  ♡ Donate a Meal
                </button>

                <button
                  className="hero-find-btn"
                  onClick={() => scrollToSection("donations")}
                >
                  ♧ Find Free Meals
                </button>
              </div>

              <div className="hero-stats">
                <div>
                  <strong>{mealsDonated.toLocaleString("en-IN")}</strong>
                  <span>Meals Donated</span>
                </div>

                <div>
                  <strong>{partnerCount.toLocaleString("en-IN")}</strong>
                  <span>Partner Donors</span>
                </div>

                <div>
                  <strong>{peopleHelped.toLocaleString("en-IN")}</strong>
                  <span>People Helped</span>
                </div>
              </div>
            </div>
          </section>

          {/* DASHBOARD PREVIEW / USER DASHBOARD */}
          <section className="dashboard-preview" id="dashboard">
            <aside className="preview-sidebar">
              <h3>♡ ShareMeal</h3>
              <p className="preview-menu-title">MENU</p>

              <div className="preview-menu active">▦ Dashboard</div>
              <div
                className="preview-menu"
                onClick={() => scrollToSection("donations")}
              >
                ♡ Find Meals
              </div>
              <div
                className="preview-menu"
                onClick={() => {
                  if (user?.role === "donor") {
                    setPage("donate");
                  } else {
                    setPage("auth");
                  }
                }}
              >
                + Donate Food
              </div>
            </aside>

            <div className="preview-main">
              <div className="preview-heading">
                <div>
                  <span>SHAREMEAL OVERVIEW</span>
                  <h2>
                    {user
                      ? `Welcome, ${user.name}!`
                      : "Community Impact Dashboard"}
                  </h2>
                </div>
                <span className="preview-live">● Live Data</span>
              </div>

              <div className="preview-stats">
                <div>
                  <small>Total Donations</small>
                  <strong>{mealsDonated}</strong>
                  <span>Food donations listed</span>
                </div>
                <div>
                  <small>Partner Donors</small>
                  <strong>{partnerCount}</strong>
                  <span>People sharing food</span>
                </div>
                <div>
                  <small>Collected Meals</small>
                  <strong>{peopleHelped}</strong>
                  <span>Donations collected</span>
                </div>
              </div>

              <div className="preview-table-heading">
                <h3>Recent Food Donations</h3>
                <a
                  href="#donations"
                  onClick={() => scrollToSection("donations")}
                >
                  View all
                </a>
              </div>

              <div className="preview-table">
                <div className="preview-row preview-table-head">
                  <span>FOOD ITEM</span>
                  <span>DONOR</span>
                  <span>QUANTITY</span>
                  <span>STATUS</span>
                </div>

                {foods.slice(0, 3).map((food) => (
                  <div className="preview-row" key={food._id}>
                    <strong>{food.foodName}</strong>
                    <span>{food.donorName}</span>
                    <span>{food.quantity}</span>
                    <span className="preview-status">
                      {food.status || "Available"}
                    </span>
                  </div>
                ))}

                {foods.length === 0 && (
                  <div className="preview-empty">
                    No donations yet. Be the first to share a meal!
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* FOOD LISTINGS */}
          <section className="donations-section" id="donations">
            <div className="section-heading">
              <span className="eyebrow">SHARE FOOD • SPREAD KINDNESS</span>
              <h2>Find Available Meals</h2>
              <p>
                Discover food shared by generous donors in your
                community.
              </p>
            </div>

            <div className="food-filters">
              <input
                type="text"
                placeholder="Search food or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Meals">Meals</option>
                <option value="Fruits">Fruits</option>
                <option value="Vegetables">Vegetables</option>
                <option value="Snacks">Snacks</option>
                <option value="Bakery">Bakery</option>
                <option value="Others">Others</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
                <option value="Collected">Collected</option>
              </select>
            </div>

            <div className="food-grid">
              {filteredFoods.map((food) => (
                <article className="food-card" key={food._id}>
                  <div className="food-image">
                    <img
                      className="food-photo"
                      src={getFoodImage(food.category)}
                      alt={food.foodName}
                    />
                    <span className="available-badge">
                      {food.status || "Available"}
                    </span>
                  </div>

                  <div className="food-details">
                    <span className="food-category">
                      {food.category}
                    </span>

                    <h3>{food.foodName}</h3>

                    <p>♙ Donor: {food.donorName}</p>
                    <p>♧ Quantity: {food.quantity}</p>
                    <p>⌖ Location: {food.location}</p>
                    <p>
                      ◷ Pickup: {getTimeLeft(food.pickupDeadline)}
                    </p>

                    {user?.role === "receiver" &&
                      (food.status || "Available") === "Available" && (
                        <button
                          className="request-btn"
                          onClick={() => requestFood(food._id)}
                        >
                          Reserve Food
                        </button>
                      )}

                    {user?.role === "receiver" &&
                      food.status === "Reserved" && (
                        <button
                          className="request-btn collected-btn"
                          onClick={() => markAsCollected(food._id)}
                        >
                          Mark as Collected
                        </button>
                      )}

                    {user?.role === "donor" &&
                      food.donorName === user.name && (
                        <button
                          className="request-btn"
                          onClick={() => deleteDonation(food._id)}
                        >
                          Delete Donation
                        </button>
                      )}

                    {!user && (
                      <button
                        className="request-btn"
                        onClick={() => {
                          setAuthMode("login");
                          setPage("auth");
                        }}
                      >
                        Sign In to Reserve
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {filteredFoods.length === 0 && (
              <div className="preview-empty">
                No food donations found. Try changing your filters.
              </div>
            )}
          </section>

          {/* HOW IT WORKS */}
          <section className="about-section" id="how-it-works">
            <span className="eyebrow">SIMPLE STEPS, BIG IMPACT</span>
            <h2>How ShareMeal Works</h2>
            <p>
              Donors share available food. Receivers discover and
              reserve meals. Together, we reduce food waste and help
              people in need.
            </p>
          </section>

          <section className="about-section" id="about">
            <h2>Food Brings Us Together</h2>
            <p>
              ShareMeal connects people who have extra food with
              people who need a meal. Every contribution makes a
              difference.
            </p>
          </section>
        </>
      )}

      {/* LOGIN / REGISTER PAGE */}
      {page === "auth" && (
        <section className="donation-form-section" id="auth-section">
          <div className="section-heading">
            <span className="eyebrow">WELCOME TO SHAREMEAL</span>
            <h2>
              {authMode === "login" ? "Sign In" : "Create an Account"}
            </h2>
            <p>
              {authMode === "login"
                ? "Sign in to continue sharing meals."
                : "Join our community and make a difference."}
            </p>
          </div>

          <form className="donation-form" onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <label className="full-width">
                Full Name
                <input
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  value={authForm.name}
                  onChange={handleAuthChange}
                  required
                />
              </label>
            )}

            <label className="full-width">
              Email Address
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={authForm.email}
                onChange={handleAuthChange}
                required
              />
            </label>

            <label className="full-width">
              Password
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={authForm.password}
                onChange={handleAuthChange}
                required
              />
            </label>

            {authMode === "register" && (
              <label className="full-width">
                Select Your Role
                <select
                  name="role"
                  value={authForm.role}
                  onChange={handleAuthChange}
                >
                  <option value="receiver">Receiver</option>
                  <option value="donor">Donor</option>
                </select>
              </label>
            )}

            <div className="form-actions full-width">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setPage("home");
                  setError("");
                }}
              >
                Back
              </button>

              <button
                type="submit"
                className="primary-btn"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Sign In"
                  : "Register"}
              </button>
            </div>
          </form>

          <p style={{ textAlign: "center", marginTop: "22px" }}>
            {authMode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              type="button"
              className="nav-signin"
              onClick={() => {
                setAuthMode(
                  authMode === "login" ? "register" : "login"
                );
                setError("");
              }}
            >
              {authMode === "login" ? "Register" : "Sign In"}
            </button>
          </p>
        </section>
      )}

      {/* DONATION FORM */}
      {page === "donate" && (
        <section
          className="donation-form-section"
          id="donation-form"
        >
          <div className="section-heading">
            <span className="eyebrow">MAKE A DIFFERENCE</span>
            <h2>Donate Food</h2>
            <p>
              Share your extra food with someone who needs it.
            </p>
          </div>

          <form className="donation-form" onSubmit={handleSubmit}>
            <label>
              Donor Name
              <input
                type="text"
                name="donorName"
                value={user?.name || ""}
                placeholder="Your name"
                readOnly
              />
            </label>

            <label>
              Food Name
              <input
                type="text"
                name="foodName"
                value={donationForm.foodName}
                onChange={handleDonationChange}
                placeholder="Example: Vegetable rice"
                required
              />
            </label>

            <label>
              Food Category
              <select
                name="category"
                value={donationForm.category}
                onChange={handleDonationChange}
                required
              >
                <option value="Meals">Meals</option>
                <option value="Fruits">Fruits</option>
                <option value="Vegetables">Vegetables</option>
                <option value="Snacks">Snacks</option>
                <option value="Bakery">Bakery</option>
                <option value="Others">Others</option>
              </select>
            </label>

            <label>
              Quantity
              <input
                type="text"
                name="quantity"
                value={donationForm.quantity}
                onChange={handleDonationChange}
                placeholder="Example: 5 plates"
                required
              />
            </label>

            <label>
              Pickup Location
              <input
                type="text"
                name="location"
                value={donationForm.location}
                onChange={handleDonationChange}
                placeholder="Enter pickup location"
                required
              />
            </label>

            <label>
              Pickup Deadline
              <input
                type="datetime-local"
                name="pickupDeadline"
                value={donationForm.pickupDeadline}
                onChange={handleDonationChange}
                min={new Date().toISOString().slice(0, 16)}
                required
              />
            </label>

            <div className="form-actions full-width">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setPage("home")}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-btn"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Donation"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* FEEDBACK */}
      {(message || error) && (
        <div
          role={error ? "alert" : "status"}
          style={{
            maxWidth: "900px",
            margin: "20px auto",
            padding: "14px 18px",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          {error || message}
        </div>
      )}

      {/* FOOTER */}
      <footer>
        <a
          href="#home"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className="brand-icon">♡</span>
          <span>ShareMeal</span>
        </a>

        <p>Share food. Spread kindness. Reduce waste.</p>
        <small>© 2026 ShareMeal. All rights reserved.</small>
      </footer>
    </div>
  );
}

export default App;
