from backend.database import engine, Base
from backend import models

def initialize_database():
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

    for table in Base.metadata.sorted_tables:
        print("Table:", table.name)

if __name__ == "__main__":
    initialize_database()