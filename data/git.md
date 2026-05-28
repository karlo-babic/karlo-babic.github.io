## SSH Clone

### Generate an SSH key
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### Start the SSH agent
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### Copy the public key
```bash
cat ~/.ssh/id_ed25519.pub
```
Add the copied key to GitHub:
* https://github.com/settings/keys

### Clone the repository
```bash
git clone git@github.com:USERNAME/REPO.git
```

### Configure Git Identity
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```
