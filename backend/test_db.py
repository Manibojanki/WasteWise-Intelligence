from sqlalchemy import text
from backend.database import engine

try:
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database()")
        )

        print("Database connected successfully!")
        print("Database:", result.scalar())

except Exception as e:
    print("Database connection failed:")
    print(e)