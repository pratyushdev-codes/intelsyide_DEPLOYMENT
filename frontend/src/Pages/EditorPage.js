import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Client from '../Components/Client';
import Editor from '../Components/Editor';
import { initSocket } from '../Socket';
import ACTIONS from '../Action';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import AccessibilityBar from '../Components/AccessibilityBar';
import AiAPI from '../Components/aiAPI';
import html2canvas from 'html2canvas';
import axios from 'axios';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown for rendering markdown content




// Loading image URL
const loadingImage = '../images/loading.gif'; // Replace with your actual loading image URL
const loadingImageassist='../images/loading.gif'

function EditorPage() {
  const [editorScreenshot, setEditorScreenshot] = useState(null);
  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  const [clients, setClients] = useState([]);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('Select Language');
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false); // New state for loading indicator
  const [assistloading, setAssistloading]=useState(false); //New state for assist loading inficator
  const [assistAnswer, setAssistAnswer] = useState(""); // State to hold the assist answer
  const [explainAnswer, setExplainAnswer] = useState(""); // State to hold the explain answer
  const [explainloading ,  setExplainloading]=  useState(false);
  const [copyloading ,  setCopyloading]= useState(false); //loading state for copy button
  const [rceloading, setreceLoding]= useState(false);
  useEffect(() => {
    const init = async () => {
      try {
        socketRef.current = await initSocket();
        socketRef.current.on('connect_error', (err) => handleErrors(err));
        socketRef.current.on('connect_failed', (err) => handleErrors(err));

        socketRef.current.emit(ACTIONS.JOIN, {
          roomId,
          username: location.state?.username,
        });

        socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the Playground`);
          }
          setClients(clients);

          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
        });
        });

        socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
          toast.error(`${username} left the Playground`);
          setClients((prev) => {
            return prev.filter((client) => client.socketId !== socketId);
          });
        });
      } catch (error) {
        handleErrors(error);
      }
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
      }
    };
  }, [roomId, location.state?.username]);

  const handleErrors = (error) => {
    toast.error('Socket Connection Failed, try again later');
    reactNavigator('/');
  };

  const runCode = async () => {
    setLoading(true);
    toast.loading('RCE engine is working...');
    setreceLoding(true);

    if (!code || language === 'Select Language') {
      toast.error('Please select a language and enter code to run.');
      return;
    }
  
    setLoading(true);
 
  
    try {
      const response = await axios.post(
         `${process.env.REACT_APP_AWS_API_URL}`,
        {
          code: code,
          language: language,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
  
      // Extract and format the output
      const formattedOutput = response.data.body.trim().replace(/\\n/g, '\n').replace(/(^"|"$)/g, '');
      setOutput(formattedOutput);
    
      setreceLoding(false);
      toast.dismiss();
      toast.success("Intelsy Compiler: Output Generated");
    
    } catch (error) {
      console.error("Error fetching from API:", error.message);
      toast.error("RCE couldn't generate output");
      setOutput({ error: error.message });
    } finally {
      setLoading(false);
      
     
    }
  };
  
  const snapShot = () => {
    html2canvas(editorRef.current).then((canvas) => {
      setEditorScreenshot(canvas.toDataURL());
    });
  };
//function to copy the code to clipboard

const copyCodeToClipboard = () => {
  setCopyloading(true);
  if (code) {
    navigator.clipboard.writeText(code).then(() => {
      toast.success(' Code copied to clipboard!');
    setCopyloading(false)
    }).catch((err) => {
      console.error('Failed to copy code:', err);
      toast.error('❌ Failed to copy code.');
    });
  } else {
    toast.error('No code to copy!');
  }
};

//function to donwload the code 
const downloadCode = () => {
  if (!code || language === 'Select Language') {
    toast.error('Please select a language and enter code to download.');
    return;
  }

  let filename = 'main';
  switch (language) {
    case 'python':
      filename += '.py';
      break;
    case 'java':
      filename += '.java';
      break;
    case 'cpp':
      filename += '.cpp';
      break;
    default:
      filename += '.txt';
  }

  const blob = new Blob([code], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);

  toast.success(`Code downloaded as ${filename}`);
};



  // Function to generate assist answer
const generateAssist = async (code) => {
  setAssistloading(true);
  try {
    const assistresponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.REACT_APP_INTELSYAIKEY}`,
      {
        contents: [{ parts: [{ text: "Please assist me in this code, is there any error in the provided code and if there is a error how should I resolve it?, keep your response short and to the point only"+JSON.stringify(code) }] }]
      }
    );
    setAssistAnswer(JSON.stringify(assistresponse.data.candidates[0].content.parts[0].text));
    toast.success(" Your code assistant is here with helpful tips!")
  } catch (error) {
    console.error("Error fetching assist from API:", error.message);
    toast.error("Intelsy AI couldn't generate response")
    setAssistAnswer("Sorry, something went wrong. Please try again!");
  }
  setAssistloading(false);
};

  

  // Function to generate explain answer (placeholder implementation)
  const generateExplain = async (code) => {
    setExplainloading(true);

    try{
      const explainresponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.REACT_APP_INTELSYAIKEY}`,
        {
          contents: [{ parts: [{ text: "Explain me the code that I have provided you"+JSON.stringify(code) }] }]
        }
      );
      setExplainAnswer(JSON.stringify(explainresponse.data.candidates[0].content.parts[0].text));
      toast.success(" Here's an explanation for your code!")
    }catch(error){
      console.error("Error fetching explain from API:", error.message);
      toast.error("Intelsy AI couldn't generate response")

      setExplainAnswer("Sorry, something went wrong. Please try again!");
    }



 
    setExplainloading(false);
  };

  //Function to copy room ID
async function copyRoomId(){
  try {
    

    await navigator.clipboard.writeText(roomId);
    toast.success("Room ID Copied to Clipboard.")
  } catch (error) {
    toast.error(console.log(error)+"Could not copy Room Id")
    
  }
}

  if (!location.state) {
    return <Navigate to="/" />;
  }

  //Function to leave the room

  async function leaveRoom(){
   reactNavigator("/")

  }

  return (
    <>
      <div className='mainWrap'>

        {/* Explain Modal */}
      <div className="modal" style={{ zIndex: "10000" , borderRadius:"30px"}} id="explainModal" tabIndex="100" aria-labelledby="exampleModalLabel" aria-hidden="true">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{color:"#036EFD", backgroundColor:"#1B1C1F"}}>
                  <h1 className="modal-title fs-5" id="exampleModalLabel" style={{color:"#036EFD"}}>   <i className="fa-solid fa-lightbulb" style={{ color: '#EC7A6F' }}></i>&nbsp; &nbsp;Intelsy AI Explain</h1>
                </div>
                <div className="modal-body " style={{color:"white", backgroundColor:"#1B1C1F"}}>
                <ReactMarkdown className="p-3">{explainAnswer}</ReactMarkdown>
                </div>
                <div className="modal-footer" style={{backgroundColor:"#1B1C1F"}}>
                  {/* <button type="button" className="btn btn-secondary" data-bs-dismiss="modal"  style={{borderRadius:"20px"}}>Close</button> */}
                  <button type="button" className="btn btn-primary" data-bs-dismiss="modal" style={{borderRadius:"20px"}}>Close</button>
                </div>
              </div>
            </div>
          </div>

{/* Assist Modal */}

<div className="modal" style={{ zIndex: "10000" , borderRadius:"30px"}} id="assistModal" tabIndex="100" aria-labelledby="exampleModalLabel" aria-hidden="true">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{color:"#036EFD", backgroundColor:"#1B1C1F"}}>
                  <h1 className="modal-title fs-5" id="exampleModalLabel" style={{color:"#036EFD"}}>    <i className="fa-solid fa-circle-half-stroke" style={{ color: '#EC7A6F' }}></i>&nbsp; &nbsp;Intelsy Code Assist</h1>
                </div>
                <div className="modal-body " style={{color:"white", backgroundColor:"#1B1C1F"}}>
                <ReactMarkdown className="p-3">{assistAnswer}</ReactMarkdown>
                </div>
                <div className="modal-footer" style={{backgroundColor:"#1B1C1F"}}>
                  {/* <button type="button" className="btn btn-secondary" data-bs-dismiss="modal"  style={{borderRadius:"20px"}}>Close</button> */}
                  <button type="button" className="btn btn-primary" data-bs-dismiss="modal" style={{borderRadius:"20px"}}>Close</button>
                </div>
              </div>
            </div>
          </div>

        <div className='rightAside' style={{ zIndex: "+1" }}>
          <div className='rightasideInner'>
            <h3 style={{ color: 'grey' }}>
            <span style={{ color: 'white', fontWeight: 'bold' }}>
  Intelsy 
  <span style={{ color: '#036EFD', display: 'inline-flex', alignItems: 'center' }}>
    AI &nbsp; 
    <i 
      className="fa-brands fa-slack" 
      style={{ 
        animation: 'rotate 12s linear infinite' 
      }}
    ></i>
    {/* &nbsp;<img src="../images/Ai.gif" alt="AI" style={{ verticalAlign: "right", height: "25px" }} /> */}
  </span>

  <style>
    {`
      @keyframes rotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `}
  </style>
</span>

              <br />
              <span style={{ fontSize: '20px' }}>
                Transform your coding experience.
              </span>
            </h3>
            <button
          type=""
          className="btn  my-2"
   
          style={{ backgroundColor:"rgb(46 47 50)" ,borderRadius:"20px", width:"-webkit-fill-available", color:"white",  marginLeft:"0.7rem", marginRight:"1rem",      padding: "0.6rem 1rem",    textAlign: "left" ,   alignItems: "center" }}
        >
          <img src="../images/active.jpg" style={{borderRadius:"50%" , height:"18px" ,   animation: 'rotate 1s linear infinite'  , marginRight: "0.5rem", width:"18px"}}/> Status:  Active
          {/* <i className="fa-solid fa-signal mx-2"></i> */}

        </button>
        <br/>
            <AiAPI />
            
          </div>
        </div>

        <div className='aside' style={{ boxShadow: "0 4px 8px 0 rgba(0, 0, 0, 0.7), 0 6px 20px 0 rgba(0, 0, 0, 0.19)" }}>
          <div className='asideInner'>
            <div className='logo'>
              {/* <img
                className='logoImage'
                src="../images/logo.png"
                alt="Logo"
              /> */}
              <h3 style={{ color: 'grey' }}>
                <span style={{ color: 'white', fontWeight: 'bold' }}>
                  Your Playground is ready<i className="fa-solid fa-terminal my-3 mx-3" style={{ background: 'linear-gradient(112deg, rgb(3, 110, 253), rgb(236, 122, 111)) text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'  }}></i>
                </span>
                <br />
                <span style={{ fontSize: '20px' }}>Start developing!</span>
              </h3>
              <br />
              <h3 style={{ color: '#036EFD', fontSize: '22px', fontWeight: 'bold' }}>
                Playground Players &nbsp; <img src='/images/user.png' style={{ width: "21px", height: "21px" }} />
              </h3>
              <div className="clientsList">
                {clients.map((client) => (
                  <Client
                    key={client.socketId}
                    username={client.username}
                  />
                ))}
              </div>
            </div>
          </div>
          <button type="button" className='btn copyBtn' onClick={copyRoomId} style={{
            background: "rgb(157,86,224)",
            background: "radial-gradient(circle, rgba(157,86,224,1) 0%, rgba(253,130,85,1) 100%)",
            borderRadius: "20px",
            color: "white",
            boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)"
          }}><i class="fa-regular fa-paste"></i> &nbsp; Copy Room ID</button>

          <button type="button" className='btn leaveBtn'  onClick={leaveRoom} style={{ backgroundColor: "#036EFD", borderRadius: "20px", color: "white" }}> <i class="fa-solid fa-arrow-right-from-bracket"></i> &nbsp;&nbsp;&nbsp;Leave Room</button>
          
        </div>
        <div className='editorWrap'>
          <div className='topBar'>
            <AccessibilityBar takeScreenshot={snapShot} />
          </div>
          <div className='bottomCenter' style={{
            zIndex: "999",
            backgroundColor: "#171717",
            borderTopLeftRadius: '10px',
            borderTopRightRadius: "10px",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            
            
          }}>
            <div className='codeOutput' style={{
              padding: "10px",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '90%',
              marginBottom: '5px'
            }}>
              <div className="dropdown">
                <button
                  className="btn btn-secondary mx-2 dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                  style={{
                    borderRadius: "20px",
                  
                    borderColor: "darkgrey",
                    backgroundColor: "#090300",
                    color: "#036EFD",
                  }}
                >
                  <i className="fa-solid fa-circle-chevron-down" style={{ color: "#EC7A6F" }}></i> &nbsp;
                  {language}
                </button>
                <ul className="dropdown-menu">
                  <li onClick={() => setLanguage("java")}>
                    Java
                  </li>
                  <li onClick={() => setLanguage("python")}>
                    Python
                  </li>
                  <li onClick={() => setLanguage("cpp")}>
                    C++
                  </li>
                </ul>
              </div>
              
              {!loading && (
                <button type="button" id="submit" onClick={runCode} className="btn btn-secondary mx-2"
                  style={{ display: 'flex', alignItems: 'center', borderRadius: "20px", borderColor: "white", backgroundColor: "#090300", color: "#036EFD" }}>
                  <i className="fa-solid fa-play mx-1" style={{ color: "#EC7A6F", marginRight: '5px' }}></i> &nbsp; Run
                </button>
              )}
              {loading && (
                <button type="button" className="btn btn-secondary mx-2"
                  style={{ borderRadius: "20px", borderColor: "white", backgroundColor: "#090300", color: "#036EFD" }}>
                  <img src={loadingImage} alt="Loading..." style={{ height: '25px' }} />
                </button>
              )}

{!copyloading &&(
  <button
  type="button"
  className="btn btn-secondary mx-1"
  style={{ borderRadius: "20px", borderColor: "white", backgroundColor: "#090300", color: "#036EFD" }}
  onClick={copyCodeToClipboard}
>
  <i className="fa-solid fa-copy" style={{ color: "#EC7A6F" }}></i> &nbsp;Copy
</button>

)}


{copyloading &&(
  <button
  type="button"
  className="btn btn-secondary mx-1"
  style={{ borderRadius: "20px", borderColor: "white", backgroundColor: "#090300", color: "#036EFD" }}
  onClick={copyCodeToClipboard}
>
<img src={loadingImageassist} alt="Loading..." style={{ height: '25px' }} />
</button>

)}




{(copyloading)}

              {/* Assist Dropdown */}
              <div>
                {!assistloading && (

              
  <button
    type="button"
    className="btn btn-secondary mx-1 "
    style={{
      borderRadius: "20px",
      borderColor: "white",
      backgroundColor: "#090300",
      color: "#036EFD",
    }}
   data-bs-toggle="modal" data-bs-target="#assistModal"
    onClick={() => generateAssist(code)}
  >
    <i className="fa-solid fa-circle-half-stroke mx-1" style={{ color: "#EC7A6F" }}></i>
    <span className="mx-1" style={{ color: "#036EFD" }}>
      Assist
    </span>
  </button>
    )} 

    {assistloading &&(
  <button
    type="button"
    className="btn btn-secondary mx-1 dropdown-toggle"
    style={{
      borderRadius: "20px",
      borderColor: "white",
      backgroundColor: "#090300",
      color: "#036EFD",
    }}
    id="assistDropdown"
    data-bs-toggle="dropdown"
    aria-expanded="false"
    onClick={() => generateAssist(code)}
  >
    <i className="fa-solid fa-circle-half-stroke" style={{ color: "#EC7A6F" }}></i>
    <span className="mx-1" style={{ color: "#036EFD" }}>
    <img src={loadingImageassist} alt="Loading..." style={{ height: '25px' }} />
    </span>
  </button>
    )} 
    
  <ul
    className="dropdown-menu"
    aria-labelledby="assistDropdown"
    style={{
      maxHeight: "200px", // Set max height for scrolling
      overflowY: "auto",  // Enable vertical scrolling
    }}
  >
    <li style={{ whiteSpace: "pre-wrap" }}> {/* Preserve whitespace for code formatting */}
      {assistAnswer}
    </li>
  </ul>
</div>




              {/* Explain Dropdown */}
              <div>
              {!explainloading && (
                <button
                  type="button"
                  className="btn btn-secondary mx-1 " 
                  style={{
                    borderRadius: "20px",
                    borderColor: "white",
                    backgroundColor: "#090300",
                    color: "#036EFD",
                  }}
                  data-bs-toggle="modal" data-bs-target="#explainModal"
           
                  onClick={() => generateExplain(code)}// Call generateExplain function on click
                >
                  <i className="fa-solid fa-lightbulb" style={{ color: "#EC7A6F" }}></i>
                  <span className="mx-2" style={{ color: "#036EFD" }}>
                    Explain
                  </span>
                </button>
                   )}

{explainloading && (

<button
type="button"
className="btn btn-secondary mx-1 dropdown-toggle"
style={{
  borderRadius: "20px",
  borderColor: "white",
  backgroundColor: "#090300",
  color: "#036EFD",
}}
id="explainDropdown"
data-bs-toggle="dropdown"
aria-expanded="false"
onClick={() => generateExplain(code)}// Call generateExplain function on click
>
<i className="fa-solid fa-lightbulb" style={{ color: "#EC7A6F" }}></i>
<span className="mx-2" style={{ color: "#036EFD" }}>
<img src={loadingImageassist} alt="Loading..." style={{ height: '25px' }} />
</span>
</button>


)}

                <ul className="dropdown-menu" aria-labelledby="explainDropdown">
                  <li>
                    <ReactMarkdown className="p-3">{explainAnswer}</ReactMarkdown>
                  </li>
                </ul>
              </div>
             
              <button
  type="button"
  className="btn btn-secondary mx-1"
  style={{ borderRadius: "20px", borderColor: "white", backgroundColor: "#090300", color: "#036EFD" }}
  onClick={downloadCode}
>
  <i className="fa-solid fa-download" style={{ color: "#EC7A6F" }}></i> &nbsp;Download
</button>

            </div>

            <div className='codeOutput' style={{
              padding: "10px",
              backgroundColor: "#0F1117",
              width: "90%",
              borderRadius: "10px",
              height: "80vh",
              overflow: 'auto'
            }}>
{output ? (
  <pre style={{ color: '#FFF', display: 'inline-block' }}>
    <i className="fa-solid fa-terminal" style={{ color: "white", animation: "blink 1s infinite" }}></i>&nbsp;
    {JSON.stringify(output, null, 2)}
  </pre>
) : (
  <p style={{ color: '#FFF' }}>
    <i className="fa-solid fa-terminal" style={{ color: "white", animation: "blink 1s infinite" }}></i>&nbsp;
  </p>
)}

            </div>
          </div>

          <Editor socketRef={socketRef} roomId={roomId} code={code} setCode={setCode} ref={editorRef}  onCodeChange={(code) => {
                        codeRef.current = code;
                    }} />
        </div>
      </div>
    </>
  );
}

export default EditorPage;
