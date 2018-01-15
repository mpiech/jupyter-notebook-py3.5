# (ideally) minimal pyspark/jupyter notebook

FROM radanalyticsio/openshift-spark:2.2-latest

USER root

## taken/adapted from jupyter dockerfiles
# Not essential, but wise to set the lang
# Note: Users with other languages should set this in their derivative image
ENV LANGUAGE=en_US.UTF-8 \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    PYTHONIOENCODING=UTF-8 \
    CONDA_DIR=/opt/conda \
    NB_USER=nbuser \
    NB_UID=1011 \
    NB_PYTHON_VER=3.5 \
    PATH=$CONDA_DIR/bin:$PATH \
    SPARK_HOME=/opt/spark \
    MINICONDA_VERSION=4.3.21

# TODO remove tini after docker 1.13.1

LABEL io.k8s.description="PySpark Jupyter Notebook." \
      io.k8s.display-name="PySpark Jupyter Notebook." \
      io.openshift.expose-services="8888:http"


RUN echo 'PS1="\u@\h:\w\\$ \[$(tput sgr0)\]"' >> /root/.bashrc \
    && chgrp root /etc/passwd \
    && chgrp -R root /opt \
    && chmod -R ug+rwx /opt \
    && useradd -m -s /bin/bash -N -u $NB_UID $NB_USER \
    && usermod -g root $NB_USER \
    && yum install -y curl wget curl tree java-headless bzip2 gnupg2 sqlite3 gcc gcc-c++ glibc-devel git mesa-libGL mesa-libGL-devel ca-certificates vim 
    


USER $NB_USER


# Python binary and source dependencies and Development tools

# Make the default PWD somewhere that the user can write. This is
# useful when connecting with 'oc run' and starting a 'spark-shell',
# which will likely try to create files and directories in PWD and
# error out if it cannot. 
# 
ADD fix-permissions.sh /usr/local/bin/fix-permissions.sh
ENV HOME /home/$NB_USER
RUN mkdir $HOME/.jupyter \
    && cd /tmp \
    && curl -s -o Miniconda3.sh https://repo.continuum.io/miniconda/Miniconda3-4.3.21-Linux-x86_64.sh \
    && echo c1c15d3baba15bf50293ae963abef853 Miniconda3.sh | md5sum -c - \
    && bash Miniconda3.sh -b -p $CONDA_DIR \
    && rm Miniconda3.sh \
    && export PATH=$CONDA_DIR/bin:$PATH \
    && $CONDA_DIR/bin/conda config --system --prepend channels conda-forge  \
    && $CONDA_DIR/bin/conda config --system --set auto_update_conda false  \
    && $CONDA_DIR/bin/conda config --system --set show_channel_urls true  \
    && $CONDA_DIR/bin/conda update --all --quiet --yes  \
    && $CONDA_DIR/bin/conda install --quiet --yes 'nomkl' jupyter 'notebook=5.2.*' \
        'jupyterlab=0.28.*' \
        'ipywidgets=7.0*' \
        'pandas=0.19*' \
        'matplotlib=2.0*' \
        'scipy=0.19*' \
        'seaborn=0.7*' \
        'scikit-learn=0.18*' \
        'protobuf=3.*' \
	'plotly=2.2*' \
    && $CONDA_DIR/bin/conda clean -tipsy \
    && $CONDA_DIR/bin/conda remove --quiet --yes --force qt pyqt \
    && jupyter nbextension enable --py widgetsnbextension --sys-prefix \
    && fix-permissions.sh $CONDA_DIR \
    && fix-permissions.sh $HOME 


USER root

# IPython
EXPOSE 8888
WORKDIR $HOME

# Plotly patch

RUN mv $CONDA_DIR/lib/python3.6/site-packages/plotly/package_data/graphWidget.js $CONDA_DIR/lib/python3.6/site-packages/plotly/package_data/graphWidget.orig.js  \
    && mv $CONDA_DIR/lib/python3.6/site-packages/plotly/widgets/graph_widget.py $CONDA_DIR/lib/python3.6/site-packages/plotly/widgets/graph_widget.orig.py

COPY ./plotly-patch/graphWidget.js $CONDA_DIR/lib/python3.6/site-packages/plotly/package_data

COPY ./plotly-patch/graph_widget.py $CONDA_DIR/lib/python3.6/site-packages/plotly/widgets


RUN mkdir /notebooks  \
    && mkdir -p $HOME/.jupyter \
    && echo "c.NotebookApp.ip = '*'" >> $HOME/.jupyter/jupyter_notebook_config.py \
    && echo "c.NotebookApp.open_browser = False" >> $HOME/.jupyter/jupyter_notebook_config.py \
    && echo "c.NotebookApp.notebook_dir = '/notebooks'" >> $HOME/.jupyter/jupyter_notebook_config.py \
    && yum erase -y gcc gcc-c++ glibc-devel \
    && yum clean all -y \
    && rm -rf /root/.npm \
    && rm -rf /root/.cache \
    && rm -rf /root/.config \
    && rm -rf /root/.local \
    && rm -rf /root/tmp \
    && fix-permissions.sh /opt \
    && fix-permissions.sh $CONDA_DIR \
    && fix-permissions.sh /notebooks \
    && fix-permissions.sh $HOME

ENV XDG_CACHE_HOME /home/$NB_USER/.cache/
RUN export PATH=$CONDA_DIR/bin:$PATH \
    && MPLBACKEND=Agg python -c "import matplotlib.pyplot" \
    fix-permissions /home/$NB_USER

ADD start.sh /usr/local/bin/start.sh
WORKDIR /notebooks
ENTRYPOINT ["tini", "--"]
CMD ["/entrypoint", "start.sh"]

USER $NB_USER
