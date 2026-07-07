# from sqlalchemy import create_engine
# from sqlalchemy.orm import declarative_base, sessionmaker
# from Setting import settings
# import psycopg  # 👈 Pure psycopg (v3), no '2' at the end!
# # 1. Create the engine using the string from our settings
# engine = create_engine(url=settings.DB_CONNECTION)

# # 2. Create a session factory
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# # 3. Create the Base class that your database models will inherit from
# Base = declarative_base()