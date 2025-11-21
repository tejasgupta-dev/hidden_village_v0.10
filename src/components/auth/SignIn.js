import "./SignIn.css";
import circle_sprite from "../../assets/circle_sprite.png";
import scaleneTriangle_sprite from "../../assets/scaleneTriangle_sprite.png";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { saveUsername, savePassword} from './UserSaver';
import { registerNewUser } from '../../firebase/userDatabase';

const SignInScreen = ({ firebaseApp }) => {
  // takes the entered email and password and logs in the user
  const auth = getAuth(firebaseApp);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registerError, setRegisterError] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const ErrorMessage = ({ error, message }) => {
    if (error) {
      return (
        <div className="error-output">
          <span>{message}</span>
          <br></br>
          <span>Please try again.</span>
        </div>
      );
    }
    return <></>;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        saveUsername(email);
        savePassword(password);
        window.location.href = "/";
      })
      .catch((error) => {
        setLoginError(true);
        // console.error(error); // Remove error output to console
      });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError(false);
    setRegisterSuccess(false);
    
    try {
      await registerNewUser(email, password, firebaseApp);
      setRegisterSuccess(true);
      
      // Auto-login after successful registration
      setTimeout(async () => {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          saveUsername(email);
          savePassword(password);
          window.location.href = "/";
        } catch (error) {
          // console.error('Auto-login failed:', error); // Remove error output
        }
      }, 1000);
    } catch (error) {
      setRegisterError(true);
      // console.error('Registration error:', error); // Remove error output
    }
  };

  return (
    <div>
      <div className="model-loader">
        <form onSubmit={isRegisterMode ? handleRegister : handleSubmit}>
          <div className="login">
            <div className="login-inputs">
              <label htmlFor="email" className="login-input-label">
                Email
              </label>
              <input
                value={email}
                onChange={handleEmailChange}
                id="email"
                className="login-input-input"
                type="email"
                autoComplete="on"
              />
              <label htmlFor="password" className="login-input-label">
                Password
              </label>
              <input
                value={password}
                onChange={handlePasswordChange}
                id="password"
                className="login-input-input"
                type="password"
              />
              <div></div>
              <input 
                className="login-input-submit" 
                type="submit" 
                value={isRegisterMode ? "REGISTER" : "LOG IN"}
              />
              
              {/* Error/Success Messages */}
              <ErrorMessage
                error={loginError && !isRegisterMode}
                message={"Email or password is incorrect."}
              />
              <ErrorMessage
                error={registerError && isRegisterMode}
                message={"Registration failed. Email may already be in use."}
              />
              {registerSuccess && isRegisterMode && (
                <div className="error-output" style={{color: 'green'}}>
                  <span>Registration successful! Logging in...</span>
                </div>
              )}
              
              {/* Toggle between Login and Register */}
              <div style={{marginTop: '15px', textAlign: 'center'}}>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setLoginError(false);
                    setRegisterError(false);
                    setRegisterSuccess(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#000000ff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textDecoration: 'underline'
                  }}
                >
                  {isRegisterMode 
                    ? "Already have an account? Log in" 
                    : "Don't have an account? Register"}
                </button>
              </div>
            </div>
            <img src={circle_sprite} className="sprite circle-sprite" />
            <img
              src={scaleneTriangle_sprite}
              className="sprite triangle-sprite"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignInScreen;
