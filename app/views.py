from app import app
import config

from sys import path
import numpy as np
import traceback
path.insert(0,config.analysis)
path.insert(0,config.analysis+'/automaticScripts')

import os.path
import itertools as it
import glob
import cPickle as pickle
import base64
import urllib
import matplotlib
import matplotlib.cm
import re
import time
import numpy.ma as ma
import json
from shapely.geometry.point import Point

from flask import render_template
from flask import request
from flask import jsonify
from flask import url_for
from flask import send_file
from flask import send_from_directory
from flask import make_response

from sima import ImagingDataset
from sima import Sequence
from sima.ROI import ROIList
from sima.ROI import ROI
from sima.segment import SmoothROIBoundaries

from PIL import Image
import StringIO
import struct

import random

"""
def convertList16(arr):
    conv = lambda x: [int('0'+hex(int(x+0.5))[2:][:-2],16),int(hex(int(x+0.5))[2:][-2:],16)]
    return list(it.chain(*map(conv,arr)))
"""

def convertToBin(arr):
    min_val = np.min(arr)
    arr+=min_val
    dat = arr.reshape((1,arr.shape[0]))

    img = Image.fromarray(dat.astype('uint8'),'L')
    strBuffer = StringIO.StringIO()
    img.save(strBuffer, 'png')
    strBuffer.seek(0)

    imageString = "data:image/png;base64,"+base64.b64encode(strBuffer.read())

    return (imageString, min_val)


def convertToB64Jpeg(arr, quality=100):
    img = Image.fromarray(arr,'L')
    img_io = StringIO.StringIO()
    img.save(img_io, 'jpeg', quality=quality)
    img_io.seek(0)

    return 'data:image/jpeg;base64,'+base64.b64encode(img_io.read())


def convertToColorB64Jpeg(arr, quality=100):
    img = Image.fromarray(arr,'RGB')
    img.save('/home/jack/tmp/'+str(time.time())+'.png')
    img_io = StringIO.StringIO()
    img.save(img_io, 'jpeg', quality=quality)
    img_io.seek(0)

    return 'data:image/jpeg;base64,'+base64.b64encode(img_io.read())


@app.route('/')
@app.route('/index')
def index():
    ds = request.args.get('dataset')
    channel = request.args.get('channel')
    cycle = request.args.get('cycle')
    cutoff1 = request.args.get('cutoff1')
    cutoff2 = request.args.get('cutoff2')

    return render_template('index.html',dataset=ds,channel=channel,cycle=cycle,cutoff1=cutoff1,cutoff2=cutoff2)
    #return render_template('webgl_lesson1.html')

@app.route('/getInfo', methods=['GET','POST'])
def getInfo():
    ds_path = request.form.get('path')

    if (os.path.splitext(ds_path)[-1] == '.sima'):
        try:
            ds = ImagingDataset.load(ds_path)
        except IOError:
            return jsonify(error='dataset not found')

        seq = ds.__iter__().next()
    else:
        try:
            seq = Sequence.create('HDF5',ds_path,'tzyxc')
        except IOError:
            return jsonify(error='dataset not found')

    length = len(seq)
    norm_factors = {}
    for channel in xrange(seq.shape[4]):
        norm_factors['channel_' + str(channel)] = []
    
    for frame_index in [0,int(length/2),-1]:
        frame = seq._get_frame(frame_index)
        for channel in xrange(seq.shape[4]):
            subframe = frame[:,:,:,channel]
            if np.any(np.isfinite(subframe)):
                factor = np.percentile(subframe[np.where(np.isfinite(subframe))],98)
                if np.isfinite(factor):
                    norm_factors['channel_'+str(channel)] += [factor]

    json = {
        'planes': range(int(seq.shape[1]+1)),
        'height': int(seq.shape[2]),
        'width': int(seq.shape[3]),
        'length': length
    }

    for channel in norm_factors.keys():
        json[channel] = int(max(1,int(np.nanmean(norm_factors[channel]))))

    return jsonify(**json)


@app.route('/getChannels/<directory>')
def getChannels(directory):
    ds_path = directory.replace(':!','/')

    if (os.path.splitext(ds_path)[-1] == '.sima'):
        try:
            ds = ImagingDataset.load(ds_path)
        except IOError:
            return ''
        channels = ds.channel_names
    else:
        try:
            seq = Sequence.create('HDF5',ds_path,'tzyxc')
        except IOError:
            return ''
        channels = ['channel_' + str(idx) for idx in range(seq.shape[4])]

    if (len(channels) > 1):
        channels += ['overlay']
    return render_template('select_list.html',options=channels) 


@app.route('/getCycles/<directory>')
def getCycles(directory):
    ds_path = directory.replace(':!','/')

    if (os.path.splitext(ds_path)[-1] == '.sima'):
        try:
            ds = ImagingDataset.load(ds_path)
        except IOError:
            return ''
        return render_template('select_list.html',options=range(ds.num_sequences)) 

    return ''


@app.route('/getLabels', methods=['GET','POST'])
def getLabels():
    ds_path = request.form.get('path')
    try:
        dataset = ImagingDataset.load(ds_path)
    except:
        return jsonify({ 'labels': [] })

    try:
        with open(os.path.join(dataset.savedir,'rois.pkl'), 'rb') as f:
            labels = pickle.load(f).keys()
    except:
        #return ''
        return jsonify({ 'labels': [] })

    labels.extend(
        map(os.path.basename,glob.glob(os.path.join(ds_path,'ica*.npz'))))
    labels.extend(
        map(os.path.basename,glob.glob(os.path.join(ds_path,'opca*.npz'))))

    #return render_template('select_list.html',options=['']+labels)
    return jsonify({ 'labels': labels })


@app.route('/getRoiList', methods=['GET','POST'])
def getRoiList():
    ds_path = request.form.get('path')
    label = request.form.get('label')

    dataset = ImagingDataset.load(ds_path)
    rois = dataset.ROIs[label]


@app.route('/getComponenets', methods=['GET','POST'])
def getComponents():
    ds_path = request.form.get('path')
    label = request.form.get('label')   
    quality = 100
    
    if re.match('^ica',label) is not None:
        components = np.load(os.path.join(ds_path,label))['st_components']
    else:
        components = np.load(os.path.join(ds_path,label))['oPCs']

    projectedRois = {}
    for i in xrange(components.shape[3]):
        vol = components[:,:,:,i]
        cutoff = np.percentile(vol[np.where(np.isfinite(vol))],25)
        vol -= cutoff
        cutoff = np.percentile(vol[np.where(np.isfinite(vol))],99)
        vol = vol*255/cutoff
        vol = np.clip(vol, 0, 255)
        
        zsurf = np.nanmean(vol,axis=0)
        ysurf = np.nanmean(vol,axis=1)
        xsurf = np.nanmean(vol,axis=2).T

        label = 'component_' + str(i)
            
        projectedRois[label] = {
                'z':convertToB64Jpeg(zsurf.astype('uint8'),quality=quality),
                'y':convertToB64Jpeg(ysurf.astype('uint8'),quality=quality),
                'x':convertToB64Jpeg(xsurf.astype('uint8'),quality=quality)
            }

    return jsonify(**projectedRois)


@app.route('/getRoiMasks', methods=['GET','POST'])
def getRoiMasks():
    ds_path = request.form.get('path')
    label = request.form.get('label')   
    index = request.form.get('index',type=int)
    overlay = True
    quality = 100

    dataset = ImagingDataset.load(ds_path)
    rois = dataset.ROIs[label]
    num_rois = len(rois)
    if index is not None:
        indicies = [index]
    else:
        indicies = range(num_rois)
    projectedRois = {}
    
    if overlay == True:
        vol = np.zeros(list(dataset.frame_shape[:3])+[3])
        cmap = matplotlib.cm.jet
        norm = matplotlib.colors.Normalize(vmin=0, vmax=num_rois)
        m = matplotlib.cm.ScalarMappable(norm=norm, cmap=cmap)

        for index in indicies:
            color = np.array(m.to_rgba(index))[:-1]
            color /= np.sum(color)
            roiVol = np.array([plane.todense().astype(float) for plane in rois[index].mask])
            mask2 = ma.masked_where(np.logical_and(np.sum(vol,axis=-1) > 0,roiVol>0),roiVol).mask
            mask1 = ma.masked_where(np.logical_and(np.logical_not(mask2),roiVol>0),roiVol).mask

            if np.any(mask1):
                vol[mask1] = color

            if np.any(mask2):
                vol[mask2] = vol[mask2]/2+color/2

        cutoff = np.percentile(vol[np.where(np.isfinite(vol))],25)
        vol -= cutoff
        cutoff = np.percentile(vol[np.where(np.isfinite(vol))],99)
        vol = vol*255/cutoff
        vol = np.clip(vol, 0, 255)
        
        zsurf = np.nanmean(vol,axis=0)
        ysurf = np.nanmean(vol,axis=1)
        xsurf = np.swapaxes(np.nanmean(vol,axis=2),0,1)
            
        projectedRois['rois'] = {
                'z':convertToColorB64Jpeg(zsurf.astype('uint8'),quality=quality),
                'y':convertToColorB64Jpeg(ysurf.astype('uint8'),quality=quality),
                'x':convertToColorB64Jpeg(xsurf.astype('uint8'),quality=quality)
            }
        return jsonify(num_rois=num_rois,**projectedRois)
    
    for i,roi in enumerate(rois):
        mask = roi.mask
        vol = np.array([plane.todense().astype(float) for plane in mask])
        cutoff = np.percentile(vol[np.where(np.isfinite(vol))],25)
        vol -= cutoff
        cutoff = np.percentile(vol[np.where(np.isfinite(vol))],99)
        vol = vol*255/cutoff
        vol = np.clip(vol, 0, 255)
        
        zsurf = np.nanmean(vol,axis=0)
        ysurf = np.nanmean(vol,axis=1)
        xsurf = np.nanmean(vol,axis=2).T

        if roi.label is None:
            roi.label = 'roi_' + str(i)
            
        projectedRois[roi.label] = {
                'z':convertToB64Jpeg(zsurf.astype('uint8'),quality=quality),
                'y':convertToB64Jpeg(ysurf.astype('uint8'),quality=quality),
                'x':convertToB64Jpeg(xsurf.astype('uint8'),quality=quality)
            }

    return jsonify(**projectedRois)


@app.route('/getRois', methods=['GET','POST'])
def getRois():
    ds_path = request.form.get('path')
    label = request.form.get('label')   
    
    dataset = ImagingDataset.load(ds_path)
    convertedRois = {}
    try:
        rois = ROIList.load(os.path.join(dataset.savedir,'rois.pkl'),label=label)
    except:
        return jsonify({})

    for i,roi in enumerate(rois):
        if roi.id is None:
            roi.id = i

        roi_points = []
        try:
            for i in xrange(roi.im_shape[0]):
                roi_points.append([])
        except:
            for i in xrange(np.max(np.array(roi.coords)[:,:,2])):
                roi_points.append([])
        for poly in roi.polygons:
            coords = np.array(poly.exterior.coords)
            if np.all(coords[-1] == coords[0]):
                coords = coords[:-1]
            plane = int(coords[0,-1])
            coords = coords[:,:2].astype(int).tolist()
            roi_points[plane].append(coords)

        convertedRois[roi.id] = {
            'label': roi.label,
            'points': roi_points
        }

    return jsonify(**convertedRois)


@app.route('/getFrames', methods=['GET','POST'])
def getFrames():
    ds_path = request.form.get('path')
    requestFrames = request.form.getlist('frames[]',type=int)
    normingVal = request.form.getlist('normingVal[]', type=float)
    sequenceId = request.form.get('sequenceId')
    channel = request.form.get('channel')
    planes = request.form.getlist('planes[]',type=int)
    cycle = request.form.get('cycle', type=int)

    if planes is None:
        planes = [0]

    quality = 40
    if channel == 'overlay':
        channel = None

    ds = None
    if (os.path.splitext(ds_path)[-1] == '.sima'):
        ds = ImagingDataset.load(ds_path)
        seq = ds.sequences[cycle]
        channel = ds._resolve_channel(channel)
    else:
        seq = Sequence.create('HDF5',ds_path,'tzyxc')
        if channel:
            channel = int(channel.split('_')[-1])

    end = False
    frames = {}
    for frame_number in requestFrames:
        norming_val = normingVal[:]
        if frame_number > len(seq)-1 or frame_number < -1:
            end = True
            continue
        elif frame_number == -1 and ds is not None:
            try:
                time_averages = pickle.load(open(os.path.join(ds.savedir, 'time_averages.pkl')))  
                if not isinstance(time_averages,np.ndarray):
                    raise Exception('no time average')
            except:
                vol = seq._get_frame(0)
            else: 
                vol = ds.time_averages
                for ch in xrange(vol.shape[3]):
                    subframe = vol[:,:,:,ch]
                    factor = np.percentile(subframe[np.where(np.isfinite(subframe))],99)
                    if np.isfinite(factor):
                        norming_val[ch] = factor
        else:
            vol = seq._get_frame(frame_number)

        if channel is not None:
            vol = vol[:,:,:,channel]
            vol /= ((norming_val[channel])/255)
            vol = np.clip(vol, 0, 255)
        else:
            vol = np.hstack((vol[:,:,:,0]/norming_val[0],vol[:,:,:,1]/norming_val[1]))
            vol*=255
        frames['frame_'+str(frame_number)] = {};
        
        for plane in planes:
            if plane == 0:
                zsurf = np.nanmean(vol,axis=0)
            else:
                zsurf = vol[plane-1,:,:]

            if plane == 0:
                ysurf = np.nanmean(vol,axis=1)
            else:
                ysurf = np.zeros((vol.shape[0],vol.shape[2]))
                ysurf[plane-1,:]=np.nanmean(zsurf,axis=0)

            if plane == 0:
                xsurf = np.nanmean(vol,axis=2).T
            else:
                xsurf = np.zeros((vol.shape[1],vol.shape[0]))
                xsurf[:,plane-1]=np.nanmean(zsurf,axis=1).T
            
            frames['frame_'+str(frame_number)][plane] = {
                'z':convertToB64Jpeg(zsurf.astype('uint8'),quality=quality),
                'y':convertToB64Jpeg(ysurf.astype('uint8'),quality=quality),
                'x':convertToB64Jpeg(xsurf.astype('uint8'),quality=quality)
            }

    return jsonify(end=end,sequenceId=sequenceId,**frames)


@app.route('/setRoiLabel', methods=['GET','POST'])
def setRoiLabel():
    ds_path = request.form.get('path')
    #old_label = request.form.get('oldLabel')
    old_label = ''
    new_label = request.form.get('newLabel')
    
    if new_label == '':
        new_label = 'rois'

    dataset = ImagingDataset.load(ds_path)
    if (old_label != ''):
        rois = dataset.ROIs[old_label]
    else:
        rois = ROIList([])
    dataset.add_ROIs(rois, label=new_label)

    labels = dataset.ROIs.keys()

    labels.extend(
        map(os.path.basename,glob.glob(os.path.join(ds_path,'ica*.npz'))))
    labels.extend(
        map(os.path.basename,glob.glob(os.path.join(ds_path,'opca*.npz'))))

    #return render_template('select_list.html',options=['']+labels)
    return jsonify({ 'labels': labels })


@app.route('/deleteRoiSet', methods=['GET','POST'])
def deleteRoiSet():
    ds_path = request.form.get('path')
    dataset = ImagingDataset.load(ds_path)
    label = request.form.get('label')

    dataset = ImagingDataset.load(ds_path)
    dataset.delete_ROIs(label)

    return jsonify(result='success')


@app.route('/selectRoi',methods=['GET','POST'])
def selectRoi():
    ds_path = request.form.get('path')
    label = request.form.get('label')
    plane = float(request.form.get('z'))

    point = Point(float(request.form.get('x')),float(request.form.get('y')))

    dataset = ImagingDataset.load(ds_path)
    rois = ROIList.load(os.path.join(dataset.savedir,'rois.pkl'),label=label)

    for roi in rois:
        for poly in roi.polygons:
            z_coord = np.array(poly.exterior.coords)[0,2]
            if z_coord == plane or plane == -1:
                if poly.contains(point):
                    return jsonify(label=roi.label,id=roi.id)

    return jsonify({'error': 'roi not found'})


@app.route('/updateRoi',methods=['GET','POST'])
def updateRoi():
    ds_path = request.form.get('path')
    label = request.form.get('label')
    points = json.loads(request.form.get('points'))
    roi_label = request.form.get('roiLabel')
    roi_id = request.form.get('roiId')

    dataset = ImagingDataset.load(ds_path)
    roi_data = []
    for i,plane in enumerate(points):
        if plane is None or not len(plane):
            continue
        array_dat = np.array(plane)
        z_dims = i*np.ones((array_dat.shape[:2]+(1,)))
        plane_data = np.concatenate((array_dat,z_dims),axis=2)
        roi_data.extend(list(plane_data))

    for poly in roi_data:
        if poly.shape[0] < 3:
            raise Exception("unable to store polygon with less then 3 points")
    roi = ROI(polygons=roi_data,im_shape=dataset.frame_shape[:3])

    roi.label = roi_label
    roi.id = roi_id
    try:
        rois = dataset.ROIs[label]
    except KeyError:
        rois = []

    rois = filter(lambda r: r.id != roi_id, rois)
    rois.append(roi)
    dataset.add_ROIs(ROIList(rois), label=label)

    return jsonify(result='success')


@app.route('/deleteRoi',methods=['GET','POST'])
def deleteRoi():
    ds_path = request.form.get('path')
    label = request.form.get('label')
    roi_id = request.form.get('roiId')

    dataset = ImagingDataset.load(ds_path)
    try:
        rois = dataset.ROIs[label]
    except KeyError:
        return jsonify(result='failed to located ROI List')

    rois = filter(lambda r: r.id != roi_id, rois)
    dataset.add_ROIs(ROIList(rois), label=label)

    return jsonify(result='success')


@app.route('/simplifyRoi', methods=['GET','POST'])
def simplifyRoi():
    roi_id = request.form.get('roiId')
    frame_shape = json.loads(request.form.get('frame_shape'))
    points = json.loads(request.form.get('points'))
   
    roi_data = []
    for i,plane in enumerate(points):
        if plane is None or not len(plane):
            continue
        array_dat = np.array(plane)
        z_dims = i*np.ones((array_dat.shape[:2]+(1,)))
        plane_data = np.concatenate((array_dat,z_dims),axis=2)
        roi_data.extend(list(plane_data))
    try:
        roi = ROI(polygons=roi_data,im_shape=frame_shape[:3])
    except:
        return jsonify(result='failed to create ROI')

    smoother = SmoothROIBoundaries()
    roi = smoother.apply([roi])[0]

    convertedRoi = []
    try:
        for i in xrange(roi.im_shape[0]):
            convertedRoi.append([])
    except:
        for i in xrange(np.max(np.array(roi.coords)[:,:,2])):
            convertedRoi.append([])
    for poly in roi.polygons:
        coords = np.array(poly.exterior.coords)
        plane = int(coords[0,-1])
        coords = coords[:,:2].astype(int).tolist()
        convertedRoi[plane].append(coords)

    return jsonify({roi_id: {'points': convertedRoi}})


@app.route('/getFolders/<directory>')
def getFolders(directory):
    directory = directory.replace(':!','/')
    subfolders = [os.path.basename(fname) for fname in
        glob.glob(os.path.join(directory,'*')) if os.path.isdir(fname) or os.path.splitext(fname)[-1] =='.h5']
    subfolders = ['']+sorted(subfolders)
    return render_template('select_list.html',options=subfolders) 


@app.route('/saveImage', methods=['GET','POST'])
def saveImage():
    image = request.form.get('image')
    filename = request.form.get('filename')
    fh = open("/home/jack/gt2497_5/"+filename, "wb")
    fh.write(image.decode('base64'))
    fh.close()
    return jsonify(status='complete')
