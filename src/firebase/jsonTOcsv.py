import json
import csv
#import os
#import pandas as pd
#from datetime import datetime

# approach 2: just using json and csv library
# column mapping for the csv file
column_mapping = {
    "UTC Time": "timestamp.MatchUTC",
    "Unix Time Stamp": "timestamp.Match",
    "ID": "user.id",
    "ROLE": "user.admin",
    "GAME ID": "game.CurricularID",
    "GAME MODE": "game.mode",
    "DA Rep": "analytics.da_rep",
    "HINTS": "analytics.hints",
    "Hint Count": "analytics.hint_count",
    "Latin Square Order": "settings.latin_square_order",
    "HINT ORDER": "settings.hint_order",
    "CONJ": "session.conj",
    "ETSS": "session.etss",
    "ETSLO": "session.etslo",
    "Event Type": "event.type",
    "TF Given Answer": "response.tf_given_answer",
    "TF Correct": "response.tf_correct",
    "TF Correct Answer": "response.tf_correct_answer",
    "MCQ Given Answer": "response.mcq_given_answer",
    "MCQ Correct": "response.mcq_correct",
    "MCQ Correct Answer": "response.mcq_correct_answer"
}

# approach 3: using json and csv library with helper functions
import json
import csv
from datetime import datetime

# Flatten nested data for poses
def extract_poses(conjecture_data, game_id, user_id, role, timestamp):
    rows = []
    for pose, details in conjecture_data.items():
        row = {
            "UTC Time": details.get("StartUTC"),
            "Unix Time Stamp": details.get("Start"),
            "ID": user_id,
            "ROLE": role,
            "GAME ID": game_id,
            "GAME MODE": "default_mode",  # Adjust as needed
            "DA Rep": "null",  # Adjust if present
            "HINTS": "null",  # Adjust if present
            "Pose": pose,
            "Start Match": details.get("MatchUTC"),
        }
        rows.append(row)
    return rows

# Parse JSON and write to CSV
def map_and_convert_to_csv(json_data, output_file):
    rows = []

    # Iterate through games
    for game_name, game_details in json_data.items():
        curricular_id = game_details.get("CurricularID")
        for date, date_details in game_details.items():
            if isinstance(date_details, dict):
                for role, role_details in date_details.items():
                    user_id = role_details.get("UserId")
                    for timestamp, session_details in role_details.items():
                        if isinstance(session_details, dict):
                            conjecture_data = session_details.get("ConjectureId", {})
                            rows.extend(extract_poses(
                                conjecture_data, curricular_id, user_id, role, timestamp
                            ))

    # Write to CSV
    with open(output_file, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=[
            "UTC Time", "Unix Time Stamp", "ID", "ROLE", "GAME ID", "GAME MODE", "DA Rep", "HINTS", "Pose", "Start Match"
        ])
        writer.writeheader()
        writer.writerows(rows)

# Main function
def main():
    # Load JSON
    input_file = "C:/Users/adamc/Downloads/exported-json-data-2024-11-03T21-19-02.293Z.json"
    output_file = "formatted_output.csv"

    with open(input_file, "r") as file:
        json_data = json.load(file)

    # Convert and write to CSV
    map_and_convert_to_csv(json_data, output_file)

if __name__ == "__main__":
    main()


# ===========================================================================================================================================
# approach 2: just using json and csv library 
# helper function to get nested value from a dictionary
# def get_nested_value(data, path):
#     keys = path.split('.')
#     for key in keys:
#         if isinstance(data, dict) and key in data:
#             data = data[key]
#         else:
#             return None
#     return data

# # Function to read json file
# def read_json(filename):
#     # Check if file exists
#     try:
#         with open(filename, 'r') as f:
#             data = json.load(f)
#     except:
#         raise Exception("Error reading json file")
#     return data


# # map flatten json to csv
# def map_to_csv_format(data):
#     # create a dictionary to store the csv data
#     mapped_data = {col: get_nested_value(data, path) for col, path in column_mapping.items()}
#     print(mapped_data)
#     return mapped_data

# # function to normalize json data
# # def normalize_json(data):
# #     new_data = dict()
# #     for key, value in data.items():
# #         if not isinstance(value, dict):
# #             new_data[key] = value
# #         else:
# #             for k, v in value.items():
# #                 new_data[key + "_" + k] = v

# #     return new_data                              
   
# # Function to generate csv file
# def generate_csv(mapped_data_list, output_fileName):
#     # extract headers from the first mapped data entry
#     headers = column_mapping.keys()

#     # write to csv file
#     with open(output_fileName, 'w', newline='') as f:
#         writer = csv.DictWriter(f, fieldnames=headers)
#         writer.writeheader() # write header row
#         for row in mapped_data_list:
#             writer.writerow(row) # write data rows

# # Function to write data to file
# # def write_to_file(data, filepath):
    
# #     try:
# #         with open(filepath, 'w') as f:
# #             f.write(data)
# #     except:
# #         raise Exception("Error writing to file")
    

# # main function
# def main(input_file, output_file):
#     # read the json file as python dictionary
#     # make this as a input from the user
#     data = read_json(filename= input_file)

    
#     mapped_data_list = [map_to_csv_format(entry) for entry in data.values()]

#     # flatten the json data
#     # flat_json = flatten_json(data)
#     # print("Flattened json: ", flat_json)

#     #save the csv data to a file
#     generate_csv(mapped_data_list, output_file)

#     # generate desired csv data 
#     # csv_data = generate_csv(data=flat_json)

#     # normalize the nested python dictionary
#     # new_data = normalize_json(data=data)
 
#     # pretty print the normalized data
#     # print("New dictionary: ", new_data)

# if __name__ == "__main__":
#     main(input_file='C:/Users/adamc/Downloads/exported-json-data-2024-11-03T21-19-02.293Z.json', output_file='data.csv')

   
# ===========================================================================================================================================
# apporoach 1: using pandas ==== library issues

# # Function to read json file
# def read_json(filename):
#     # Check if file exists
#     try:
#         with open(filename, 'r') as f:
#             data = json.load(f)
#     # If file does not exist, raise exception
#     except:
#         raise Exception("Error reading json file")
#     # Return data
#     return data

# def create_dataframe(data):
#     # Create dataframe
#     df = pd.DataFrame()
#     # looping throug each record
#     for d in data:
#         # normalize column levels 
#         record = pd.json_normalize(d)

#         # append it to the dataframe
#         df = df.append(record, ignore_index=True)   
#     return df

# # main function
# def main():
#     # read json file
#     data = read_json(filename= 'C:/Users/adamc/Downloads/exported-json-data-2024-10-30T14-15-57.374Z.json')
#     # generate the datarame for the array items in key
#     # key is the array of the json in which you are pulling from 
#     df = create_dataframe(data = data)


#     # rename the colums in dataframe
#     print("normalized columns", df.columns.to_list())
#     df.rename(columns = {'CurricularID':'GameID'}, inplace=True)

#     print("renamed columns", df.columns.to_list())

#     # write the dataframe to csv
#     df.to_csv('data.csv', index=False)
