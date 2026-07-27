from pydantic import BaseModel


class DocPage(BaseModel):
    slug: str
    title: str
    source_file: str
    content_markdown: str


class DocIndexEntry(BaseModel):
    slug: str
    title: str
    source_file: str


class DocIndexResponse(BaseModel):
    pages: list[DocIndexEntry]
