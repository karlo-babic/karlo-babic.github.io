# Layered Grounding

## Docker
### Docker initialization
- Dockerfile:
```
FROM python:3.8.0
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt
```
- Create Docker image from the folder containing ./Dockerfile:
```
docker build -t textevol:0.1 .
```
### Docker run
- Set up a running docker container:
```
docker run -d \
  --name textevol\
  --restart always \
  -v /srv/karlo/textevol:/textevol\
  --memory=64g \
  --cpus="16" \
  --gpus "count=1,capabilities=compute" \
  textevol:0.1 \
  tail -f /dev/null
```
- Open the container:
```
docker exec -it textevol /bin/bash
```

## Jupyter Notebook
- In VS Code terminal, inside the Docker container:
```
jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser --allow-root
```

-------

https://cdn.hashnode.com/res/hashnode/image/upload/v1642773221418/7A9XnkEAEb.png
[link](https://cdn.hashnode.com/res/hashnode/image/upload/v1642773221418/7A9XnkEAEb.png)

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1642773221418/7A9XnkEAEb.png)

tests: *italic*, `inline code`, ~~crossed~~
- [ ] bla
- [x] bla!

test line
second line
third line

separate line
