from flask import Flask
from flask_restx import Api, Resource
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
api = Api(app, version='1.0', title='LetsStudySaaS API',
    description='A simple API for LetsStudySaaS backend',
)

ns = api.namespace('workbooks', description='Workbook operations')

@ns.route('/')
class WorkbookList(Resource):
    def get(self):
        '''List all workbooks'''
        return [{'id': 1, 'title': 'React and Vite Basics'}, {'id': 2, 'title': 'Flask and Swagger API'}]

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
