const admin = require('firebase-admin');
const serviceAccount = require('/Users/natebursch/Desktop/hvov0-5-firebase-adminsdk-ilvsw-dd09467f0d.json'); // Change this to your Firebase SDK path
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');
const { object } = require('prop-types');
const { getEventType } = require('xstate/lib/utils');
const { timeStamp } = require('console');
const { Timestamp } = require('firebase-admin/firestore');

// Initialize Firebase Admin SDK with service account configuration and databaseURL
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://thv-o-v06-default-rtdb.firebaseio.com' // Set this to your Firebase project URL
});

// Reference to your Firebase Realtime Database
const db = admin.database();
const ref = db.ref('/_GameID'); // Adjust to match the correct realtime database path

// This function parses the poseData and separates it into the leftHandLandmarks, rightHandLandmarks, faceLandmarks, and poseLandmarks
function parsePoseData(poseData) {
    try {
        const parsedData = JSON.parse(poseData);
        return {
            leftHandLandmarks: parsedData.leftHandLandmarks || [],
            rightHandLandmarks: parsedData.rightHandLandmarks || [],
            faceLandmarks: parsedData.faceLandmarks || [],
            poseLandmarks: parsedData.poseLandmarks || [],
        };
    } 
    // if there is an error log the error and return empty arrays
    catch (error) {
        console.error('Error parsing poseData:', error);
        return {
            leftHandLandmarks: [],
            rightHandLandmarks: [],
            faceLandmarks: [],
            poseLandmarks: [],
        };
    }
}

// Fucntion to populate the data to its respective header array
function populateLandmarkData(formattedData, prefix, landmarks, count) {
    

    for (let i = 0; i < landmarks.length; i++) {
        formattedData[`${prefix}_X_${i + 1}`] = landmarks[i].x || 'null';
        formattedData[`${prefix}_Y_${i + 1}`] = landmarks[i].y || 'null';
        formattedData[`${prefix}_Z_${i + 1}`] = landmarks[i].z || 'null';
      
      // Check if the landmarks have a visibility parameter
        if (landmarks[i].visibility) {
            formattedData[`${prefix}_Visibility_${i + 1}`] = landmarks[i].visibility;
        } else {
            formattedData[`${prefix}_Visibility_${i + 1}`] = 'null';
        }
    }

  // Set all data to 'null' if there is no data in firebase 
    if (landmarks.length === 0) {
        for (let i = 0; i < count; i++) {
            formattedData[`${prefix}_X_${i + 1}`] = 'null';
            formattedData[`${prefix}_Y_${i + 1}`] = 'null';
            formattedData[`${prefix}_Z_${i + 1}`] = 'null';
            formattedData[`${prefix}_Visibility_${i + 1}`] = 'null';
      }
  }
}

// Initialize variables to store maximum landmark size
let maxLeftHandLandmarkCount = 0;
let maxRightHandLandmarkCount = 0;
let maxFaceLandmarkCount = 0;
let maxPoseLandmarkCount = 0;

// this will fetch the data from the Firebase Realtime Database
ref.once('value', (snapshot) => {
    const data = snapshot.val(); 
     // just to check if data is getting passed through

     // If the Firebase Database is empty log the error below
    if (!data) {
        console.error('No data found in the database.');
        process.exit(1);
    }
    else {
        // Iterate through the data to find the maximum landmark counts
        Object.keys(data).forEach((objectId) => {
            const objectData = data[objectId];
            const parsedPoseData = parsePoseData(objectData.poseData);

            // Update the maximum landmark counts to their respective lengths
            maxLeftHandLandmarkCount = Math.max(maxLeftHandLandmarkCount, parsedPoseData.leftHandLandmarks.length);
            maxRightHandLandmarkCount = Math.max(maxRightHandLandmarkCount, parsedPoseData.rightHandLandmarks.length);
            maxFaceLandmarkCount = Math.max(maxFaceLandmarkCount, parsedPoseData.faceLandmarks.length);
            maxPoseLandmarkCount = Math.max(maxPoseLandmarkCount, parsedPoseData.poseLandmarks.length);
        });

        // create headers using healper function
        const leftHandHeaders = generateLandmarkHeaders('lefthandlandmark', maxLeftHandLandmarkCount);
        const rightHandHeaders = generateLandmarkHeaders('righthandlandmark', maxRightHandLandmarkCount);
        const faceLandmarkHeaders = generateLandmarkHeaders('facelandmark', maxFaceLandmarkCount);
        const poseLandmarkHeaders = generateLandmarkHeaders('poselandmark', maxPoseLandmarkCount);

        function generateLandmarkHeaders(prefix, landmarkCount) {
          const headers = [];
      
          for (let i = 1; i <= landmarkCount; i++) {
              headers.push(`${prefix}_X_${i}`, `${prefix}_Y_${i}`, `${prefix}_Z_${i}` );
      
              //Include visibility header only for "poselandmark" since the others dont include this paramater
              if (prefix === "poselandmark") {
                  headers.push(`${prefix}_Visibility_${i}`);
              }
          }
      
          return headers;
        }

        // Initialize array for the csv data
        const dataArray = [];
        // manually grab data? 
        // or write a json file to csv 

        // Iterate through each object in the data 
        // Object.keys(data).forEach((objectId) => {
        //     const objectData = data[objectId];
        //     // Parse the pose data
        //     const parsedPoseData = parsePoseData(objectData.poseData);
            

        //     // format non-landmark data
        //     const formattedData = {
        //         objectId: objectId,
        //         conjectureId: objectData.conjectureId !== undefined ? objectData.conjectureId : 'null',
        //         frameRate: objectData.frameRate || 'null',
        //         timeStamp: objectData.timestamp || 'null',
        //         UTC_Time: objectData.UTC_Time || 'null',
        //         userId: objectData.userId || 'null',
        //         role: objectData.role || 'null',
        //         gameId: objectData.gameId || 'null',
        //         gameMode: objectData.gameMode || 'null',
        //         daRep: objectData.daRep || 'null',
        //         hints: objectData.hints || 'null',
        //         hintCount: objectData.hintCount || 'null',
        //         latinSquareOrder: objectData.latinSquareOrder || 'null',
        //         hintOrder: objectData.hintOrder || 'null',
        //         etss: objectData.etss || 'null',
        //         etslo: objectData.etslo || 'null',
        //         eventType: objectData.eventType || 'null',
        //         tfGivenAnswer: objectData.tfGivenAnswer || 'null',
        //         tfCorrect: objectData.tfCorrect || 'null',
        //         tfCorrectAnswer: objectData.tfCorrectAnswer || 'null',
        //         mcqGivenAnswer: objectData.mcqGivenAnswer || 'null',
        //         mcqCorrect: objectData.mcqCorrect || 'null',
        //         mcqCorrectAnswer: objectData.mcqCorrectAnswer || 'null',
        //     };

        //     //Populate the data for leftHandLandmarks, rightHandLandmarks, faceLandmarks, and poseLandmarks
        //     populateLandmarkData(formattedData, 'lefthandlandmark', parsedPoseData.leftHandLandmarks, maxLeftHandLandmarkCount);
        //     populateLandmarkData(formattedData, 'righthandlandmark', parsedPoseData.rightHandLandmarks, maxRightHandLandmarkCount);
        //     populateLandmarkData(formattedData, 'facelandmark', parsedPoseData.faceLandmarks, maxFaceLandmarkCount);
        //     populateLandmarkData(formattedData, 'poselandmark', parsedPoseData.poseLandmarks, maxPoseLandmarkCount);

        //     // Push formatted data into the dataArray created before 
        //     dataArray.push(formattedData);
        // });
        
        // // Define the CSV headers
        // const csvHeaders = [
        //     { id: 'UTC_Time', title: 'UTC Time' },
        //     { id: 'timeStamp', title: 'UNIX Time Stamp' },
        //     { id: 'userId', title: 'ID' },
        //     { id: 'role', title: 'Role' },
        //     { id: 'gameId', title: 'Game ID' },
        //     { id: 'gameMode', title: 'Game Mode' },
        //     { id: 'daRep', title: 'DA REP' },
        //     { id: 'hints', title: 'Hints' },
        //     { id: 'hintCount', title: 'Hint Count' },
        //     { id: 'latinSquareOrder', title: 'Latin Square Order' },
        //     { id: 'hintOrder', title: 'Hint Order' },
        //     { id: 'conjectureId', title: 'Conjecture ID' },
        //     { id: 'etss', title: 'Duration of Game' },
        //     { id: 'etslo', title: 'Duration of Event' },
        //     { id: 'eventType', title: 'Event Type' },
        //     { id: 'tfGivenAnswer', title: 'True False Answer' },
        //     { id: 'tfCorrect', title: 'TF Correct' },
        //     { id: 'tfCorrectAnswer', title: 'TF Correct Answer' },
        //     { id: 'mcqGivenAnswer', title: 'MCQ Given Answer' },
        //     { id: 'mcqCorrect', title: 'MCQ Correct' },
        //     { id: 'mcqCorrectAnswer', title: 'MCQ Correct Answer' },
        //     //...generateLandmarkHeaders('lefthandlandmark', maxLeftHandLandmarkCount).map(header => ({ id: header, title: header })),
        //     //...generateLandmarkHeaders('righthandlandmark', maxRightHandLandmarkCount).map(header => ({ id: header, title: header })),
        //     //...generateLandmarkHeaders('facelandmark', maxFaceLandmarkCount).map(header => ({ id: header, title: header })),
        //     //...generateLandmarkHeaders('poselandmark', maxPoseLandmarkCount).map(header => ({ id: header, title: header })),
        //     ...leftHandHeaders.map(header => ({ id: header, title: header })),
        //     ...rightHandHeaders.map(header => ({ id: header, title: header })),
        //     ...faceLandmarkHeaders.map(header => ({ id: header, title: header })),
        //     ...poseLandmarkHeaders.map(header => ({ id: header, title: header })),
        // ];

        
        // Find the path to the 'Downloads' folder in the user's home directory
       
        // Format the filenames to include date and time of export
        const jsonFileName = `exported-json-data-${new Date().toISOString().replace(/:/g, '-')}.json`;
        const csvFileName = `exported-csv-data-${new Date().toISOString().replace(/:/g, '-')}.csv`;
        
        const downloadsFolder = path.join(require('os').homedir(), 'Downloads');
        
        // Construct the full path to the JSON and CSV files in the 'Downloads' folder
        const jsonFilePath = path.join(downloadsFolder, jsonFileName);
        const csvFilePath = path.join(downloadsFolder, csvFileName);

        // Write the JSON file to the JSON file created in the correct path
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');

        // Create CSV writer to export data to CSV file
        const csvWriter = createCsvWriter({
            path: csvFilePath,
            header: csvHeaders,
        });




        // Write the dataArray to the csv file
        csvWriter.writeRecords(dataArray)
            .then(() => {
              // log that the data has been exported correctly and exit process
                console.log('Data exported to CSV and JSON');
                process.exit(0);
            })
            .catch((error) => {
              // If there is an error log the error and exit the process
                console.error('Error writing CSV and JSON:', error);
                process.exit(1);
            });
    }
});